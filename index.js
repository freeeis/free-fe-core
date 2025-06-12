/*
 * @Description: According to the configuration and the dependency relationships, load all the modules.
 * Include module configurations, module i18n dictionaries, routers, mocks etc.
 *
 * @Author: zhiquan <x.zhiquan@gmail.com>
 * @Date: 2021-08-03 09:16:39
 * @LastEditTime: 2023-05-25 18:03:33
 * @LastEditors: zhiquan
 */

import { defineAsyncComponent } from 'vue';
import freeBuilder from './builder';
// import { extend } from 'quasar';

export default {
  init: (ctx) => {
    const { app: rootApp, store, router, config } = ctx;

    if (!rootApp) {
      throw new Error('No root app created yet!!');
    }

    const app = {
      router,
      FieldComponents: {},
      moduleNames: [],
      modules: {},
      config: {
        modules: [],
        ...config
      },
      validators: {},
      filters: {},
      backendModules: [],
      routes: [],
    };

    let builderLoaded = false;
    let {
      buildConfig,
      buildComponents,
      buildPages,
      buildRoutes,
      buildActions,
      buildValidators,
      buildStore,
      buildForConfig,
      buildI18n
    } = {};

    // all configurations stored in app.config, include config for each module
    // which will overwrite the config in the module itself.
    // app.config = config;

    // load modules, merge configurations, get ordered modules according
    // to the dependency relationship, etc.
    rootApp.config.globalProperties.ctx = app;
    rootApp.config.globalProperties.getModule = (n) => {
      return (
        app.modules[n] ||
        (() => {
          const objMdl = app.config.modules.find(
            (om) => typeof om === 'object' && om.original === n,
          )

          if (objMdl) {
            return app.modules[objMdl.name]
          }
        })()
      )
    }
    rootApp.config.globalProperties.$filter = (n, ...v) => {
      if (!n || !v) return

      let fnList = []
      if (!Array.isArray(n)) {
        if (typeof n === 'function') {
          fnList.push(n)
        } else if (typeof n === 'string') {
          fnList = fnList.concat(n.trim().split(','))
        }
      } else {
        fnList = n
      }

      let oV = v

      for (let i = 0; i < fnList.length; i += 1) {
        const fn = fnList[i]
        if (typeof fn === 'function') {
          oV = fn(...oV)
        } else if (typeof fn === 'string') {
          let filter = app.filters[fn]
          filter = filter && (filter.func || filter)
          if (typeof filter === 'function') {
            oV = filter(...oV)
          }
        }
      }

      return Array.isArray(oV) ? oV[0] : oV
    }

    // load modules from local modules folder
    // const loadModulesFromFolder = (context, pre = './free-fe-', ext = '', f = 'index.js') => {
    //   const localModules = {};
    //   const contextKeys = context.keys();
    //   for (let i = 0; i < contextKeys.length; i += 1) {
    //     if (!ext || contextKeys[i].indexOf(ext) < 0) {
    //       let mn = contextKeys[i].substr(pre.length);
    //       mn = mn.substr(0, mn.indexOf('/'));

    //       if (contextKeys[i] === `${pre}${mn}/${f}`) {
    //         localModules[mn] = context(contextKeys[i]).default || context(contextKeys[i]);
    //       }
    //     }
    //   }
    //   return localModules;
    // };

    // // load i18n dict from local modules folder
    // const loadI18nModulesFromFolder = (context, pre = './free-fe-', ext = '') => {
    //   const localI18nModules = {};
    //   const contextKeys = context.keys();
    //   for (let i = 0; i < contextKeys.length; i += 1) {
    //     if (!ext || contextKeys[i].indexOf(ext) < 0) {
    //       let mn = contextKeys[i].substr(pre.length);
    //       mn = mn.substr(0, mn.indexOf('/'));

    //       if (contextKeys[i].startsWith(`${pre}${mn}/i18n/`)) {
    //         const i18nMatch = contextKeys[i].substr(`${pre}${mn}/i18n/`.length).match(/([^/]+)\/index\.js/);
    //         if (i18nMatch && i18nMatch[1]) {
    //           localI18nModules[mn] = localI18nModules[mn] || {};
    //           localI18nModules[mn][i18nMatch[1]] = context(contextKeys[i]).default || context(contextKeys[i]);
    //         }
    //       }
    //     }
    //   }
    //   return localI18nModules;
    // };

    function loadModulesWithGlob(matchedModules, pre = './free-fe-', ext = '', f = 'index.js') {
      const localModules = {}
      Object.keys(matchedModules).forEach((path) => {
        if (!ext || path.indexOf(ext) < 0) {
          const mn = path.substring(
            path.indexOf(pre) + pre.length,
            path.indexOf('/', path.indexOf(pre) + pre.length),
          )
          if (path.endsWith(`${mn}/${f}`)) {
            // Use matchedModules[path] to dynamically import:
            const mod = matchedModules[path]
            localModules[mn] = mod.default || mod
          }
        }
      })
      return localModules
    }

    function loadI18nModulesWithGlob(matchedModules, pre = './free-fe-', ext = '') {
      const localI18nModules = {}
      Object.keys(matchedModules).forEach((path) => {
        if (!ext || path.indexOf(ext) < 0) {
          const mn = path.substring(
            path.indexOf(pre) + pre.length,
            path.indexOf('/', path.indexOf(pre) + pre.length),
          )
          if (path.startsWith(`${pre}${mn}/i18n/`)) {
            const i18nMatch = path
              .substring(`${pre}${mn}/i18n/`.length)
              .match(/([^/]+)\/index\.js/)
            if (i18nMatch && i18nMatch[1]) {
              localI18nModules[mn] = localI18nModules[mn] || {}
              localI18nModules[mn][i18nMatch[1]] = matchedModules[path].default || matchedModules[path]
            }
          }
        }
      })
      return localI18nModules
    }

    // load modules
    const localModules = loadModulesWithGlob(
      import.meta.glob('/src/modules/free-fe-*/index.js', { eager: true }),
      '/src/modules/free-fe-',
      ''
    )
    const globalModules = loadModulesWithGlob(
      import.meta.glob('/node_modules/free-fe-*/index.js', { eager: true }),
      '/node_modules/free-fe-',
      '',
    )
    const CustomerModules = loadModulesWithGlob(
      import.meta.glob('/src/modules/*/index.js', { eager: true }),
      '/src/modules/',
      'free-fe-',
    )

    // load free modules defined in _freemodule.json
    const localFreeModules = loadModulesWithGlob(
      import.meta.glob('/src/modules/free-fe-*/_freemodule.json', { eager: true }),
      '/src/modules/free-fe-',
      '',
      '_freemodule.json',
    )
    const globalFreeModules = loadModulesWithGlob(
      import.meta.glob('/node_modules/free-fe-*/_freemodule.json', { eager: true }),
      '/node_modules/free-fe-',
      '',
      '_freemodule.json',
    )
    const CustomerFreeModules = loadModulesWithGlob(
      import.meta.glob('/src/modules/*/_freemodule.json', { eager: true }),
      '/src/modules/',
      'free-fe-',
      '_freemodule.json',
    )

    // load free modules defined in _freemodule.js
    const localFreeJSModules = loadModulesWithGlob(
      import.meta.glob('/src/modules/free-fe-*/_freemodule.js', { eager: true }),
      '/src/modules/free-fe-',
      '',
      '_freemodule.js',
    )
    const globalFreeJSModules = loadModulesWithGlob(
      import.meta.glob('/node_modules/free-fe-*/_freemodule.js', { eager: true }),
      '/node_modules/free-fe-',
      '',
      '_freemodule.js',
    )
    const CustomerFreeJSModules = loadModulesWithGlob(
      import.meta.glob('/src/modules/*/_freemodule.js', { eager: true }),
      '/src/modules/',
      'free-fe-',
      '_freemodule.js',
    )

    // load i18n modules
    const localI18nModules = loadI18nModulesWithGlob(
      import.meta.glob('/src/modules/free-fe-*/i18n/*/index.js', { eager: true }),
      '/src/modules/free-fe-',
      '',
    )
    const globalI18nModules = loadI18nModulesWithGlob(
      import.meta.glob('/node_modules/free-fe-*/i18n/*/index.js', { eager: true }),
      '/node_modules/free-fe-',
      '',
    )
    const CustomerI18nModules = loadI18nModulesWithGlob(
      import.meta.glob('/src/modules/*/i18n/*/index.js', { eager: true }),
      '/src/modules/',
      'free-fe-',
    )

    const i18nMessages = {}

    const loadModule = (m) => {
      let mName
      let mOriginal

      if (typeof m === 'string') {
        mName = m
        mOriginal = m
      } else if (typeof m === 'object') {
        mName = m.name
        mOriginal = m.original || m.name

        if (!mOriginal) {
          throw `module ${m.name} is not found!`
        }
      }

      if (app.modules[mName]) return app.modules[mName]

      let mdl = CustomerModules[mOriginal] || localModules[mOriginal] || globalModules[mOriginal]
      let freeMdl =
        CustomerFreeJSModules[mOriginal] ||
        CustomerFreeModules[mOriginal] ||
        localFreeJSModules[mOriginal] ||
        localFreeModules[mOriginal] ||
        globalFreeJSModules[mOriginal] ||
        globalFreeModules[mOriginal]

      if (typeof mdl === 'function') {
        mdl = mdl(app, rootApp)
      }

      if (typeof freeMdl === 'function') {
        freeMdl = freeMdl(app, rootApp)
      }

      if (!mdl && !freeMdl) throw new Error(`Failed to load module: ${m}`)

      if (!builderLoaded) {
        ({
          buildConfig,
          buildComponents,
          buildPages,
          buildRoutes,
          buildActions,
          buildValidators,
          buildStore,
          buildForConfig,
          buildI18n,
        } = (config.builder ? config.builder : freeBuilder)({ ...ctx, freeApp: app }))

        builderLoaded = true
      }

      mdl = mdl || {}
      freeMdl = freeMdl || {}
      freeMdl.routes = [...(mdl.routes || []), ...(freeMdl.routes || [])]
      freeMdl.pages = [...(mdl.pages || []), ...(freeMdl.pages || [])]
      freeMdl.actions = [...(mdl.actions || []), ...(freeMdl.actions || [])]
      mdl = Object.merge(mdl, freeMdl)

      buildConfig(mdl)

      app.modules[mName] = mdl
      mdl.app = app

      // check dependencies
      mdl.config = mdl.config || {}
      mdl.config.dependencies = mdl.config.dependencies || []
      for (let i = 0; i < mdl.config.dependencies.length; i += 1) {
        // dependency could be a module name or an object with module config
        const dep = mdl.config.dependencies[i]

        if (typeof dep === 'object') {
          const depMdl = loadModule(dep.original ? dep : dep.name)

          if (depMdl) {
            depMdl.config = Object.assign({}, depMdl.config, dep.config)
          }
        } else {
          loadModule(dep)
        }
      }

      // merge config
      mdl.config = { ...mdl.config, ...app.config[mName] }
      app.config[mName] = { ...mdl.config }

      // register global filters from module
      if (mdl.filters) {
        app.filters = Object.assign(app.filters, mdl.filters)
      }

      // register global validators from modules
      if (mdl.validators) {
        Object.keys(mdl.validators).forEach((vk) => {
          if (typeof mdl.validators[vk] === 'function') {
            // const desc = mdl.$t(`${vk}Description`);
            app.validators[vk] = {
              name: vk,
              validator: mdl.validators[vk],
            }
          }
        })
      }

      // register module i18n translates
      let i18nMdl =
        CustomerI18nModules[mOriginal] ||
        localI18nModules[mOriginal] ||
        globalI18nModules[mOriginal]

      if (i18nMdl) {
        Object.keys(i18nMdl).forEach((ik) => {
          i18nMessages[ik] = { ...i18nMessages[ik], ...i18nMdl[ik] }
        })
      }

      if (app.moduleNames.indexOf(mName) < 0) {
        app.moduleNames.push(mName)
      }

      // check backend modules for development env
      app.backendModules = app.backendModules || []

      if (
        mdl.config &&
        mdl.config.backendDependencies &&
        Array.isArray(mdl.config.backendDependencies)
      ) {
        mdl.config.backendDependencies.forEach((d) => {
          if (app.backendModules.indexOf(d) < 0) {
            app.backendModules.push(d)
          }
        })
      }

      // build components and pages and routes from configurations
      buildComponents(mdl)
      buildPages(mdl)
      buildActions(mdl)
      buildValidators(mdl)
      buildStore(mdl)
      buildForConfig(mdl)
      buildI18n(mdl)

      return mdl
    }

    // load modules
    for (let i = 0; i < app.config.modules.length; i += 1) {
      loadModule(app.config.modules[i])
    }

    const addRefRouters = (rc) => {
      if (!rc) return rc
      if (
        typeof rc === 'string' ||
        (typeof rc === 'object' && rc.ref && typeof rc.ref === 'string')
      ) {
        // the child is string, means referrence to another module
        const rcList = (rc.ref || rc).split('>')
        const depModule = app.modules[rcList[0]]
        if (!depModule) {
          throw new Error(`Dependency ${rcList[0]} is not found!`)
        }
        if (!depModule.routers) throw new Error(`Router was not found in ${rcList[0]}`)
        if (typeof depModule.routers === 'function')
          depModule.routers = depModule.routers(app, depModule, store)
        if (!Array.isArray(depModule.routers))
          throw new Error(`Routers in ${rcList[0]} are not array!`)

        let realRouters = depModule.routers
        for (let j = 1; j < rcList.length; j += 1) {
          const rName = rcList[j]
          const childRRouter = realRouters.find(
            (rr) =>
              rr.name === rName ||
              rr.path === rName ||
              rr.name === `/${rName}` ||
              rr.path === `/${rName}`,
          )
          if (!childRRouter) {
            throw new Error(`Child router ${rName} is not found in ${rcList[0]}`)
          }

          if (j === rcList.length - 1) {
            realRouters = childRRouter
          } else {
            realRouters = childRRouter.children
          }
        }

        if (Array.isArray(realRouters)) {
          const rRouter = realRouters[0]
          realRouters = rRouter
        }

        if (rc.ref) {
          return Object.merge(realRouters, rc)
          // return Object.merge(extend(true, [], realRouters), rc);
        }
        return realRouters
        // return extend(true, [], realRouters);
      }
      if (rc.children) {
        for (let i = 0; i < rc.children.length; i += 1) {
          rc.children[i] = addRefRouters(rc.children[i])
        }
      }

      return rc
    }

    const modifyModuleView = (routers, view, p = '') => {
      for (let i = 0; i < routers.length; i += 1) {
        const router = routers[i]

        if (
          new RegExp(view.view).test(`${p}/${router.path}`) &&
          (!router.children || router.children.findIndex((cld) => cld.path === '') < 0)
        ) {
          router.component = view.component || router.component
          router.props = view.props || router.props
        }

        if (router.children) {
          modifyModuleView(router.children, view, `${p}/${router.path}`)
        }
      }
    }

    // process with each module
    for (let i = 0; i < app.moduleNames.length; i += 1) {
      const mdl = app.modules[app.moduleNames[i]]

      Object.merge(mdl.config, app.config[app.moduleNames[i]] || {})
      app.config[app.moduleNames[i]] = mdl.config || {}

      // load routers from modules
      mdl.routers = mdl.routers || []
      let mRouters = mdl.routers

      // routes from code
      if (typeof mRouters === 'function') {
        mRouters = mRouters(app, mdl, store)
      }
      if (mRouters && Array.isArray(mRouters)) {
        buildRoutes(mdl, mRouters)
        for (let j = 0; j < mRouters.length; j += 1) {
          mRouters[j] = addRefRouters(mRouters[j])
        }
      }

      mdl.routers = mRouters

      // register components in modules
      if (mdl.components) {
        Object.keys(mdl.components).forEach((k) => {
          rootApp.component(
            k,
            defineAsyncComponent(
              () =>
                new Promise((resolve) => {
                  resolve(mdl.components[k])
                }),
            ),
          )
        })
      }

      // register field components in the modules to app
      if (mdl.fieldComponents && typeof mdl.fieldComponents === 'object') {
        app.FieldComponents = Object.assign(app.FieldComponents, mdl.fieldComponents)
      }

      // register mock api
      if (mdl.mock && typeof mdl.mock === 'function') {
        const mockParent = rootApp.config && rootApp.config.globalProperties
        if (mockParent) {
          mdl.mock(mockParent.Mock)
        }
      }

      // modify module views
      if (
        mdl.config &&
        mdl.config.views &&
        Array.isArray(mdl.config.views) &&
        mdl.config.views.length
      ) {
        for (let j = 0; j < mdl.config.views.length; j += 1) {
          const view = mdl.config.views[j]

          if (view && view.module && view.view) {
            const module = app.modules[view.module]
            if (module && module.routers) {
              modifyModuleView(module.routers, view)
            }
          }
        }
      }
    }

    // register i18n translates
    Object.keys(config.i18n || {}).forEach((ik) => {
      i18nMessages[ik] = { ...i18nMessages[ik], ...config.i18n[ik] }
    })

    if (ctx.store) {
      ctx.store.i18nMessages = i18nMessages
    }

    ctx.app.i18nMessages = i18nMessages

    // get route list from module routers and merge config
    let routes = []
    for (let i = 0; i < app.config.modules.length; i += 1) {
      const mdli = app.config.modules[i]
      const mdlName = typeof mdli === 'string' ? mdli : mdli.name

      const mdl = app.modules[mdlName]
      if (mdl && mdl.routers && (!app.config.rootModule || mdlName === app.config.rootModule)) {
        routes = routes.concat(mdl.routers)
      }
    }

    app.routes = routes

    return {
      app,
      routes,
    }
  },
}
