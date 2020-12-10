import { App } from './components/App'
import { Index } from './components/Index'
import { NamedSelectors } from './components/NamedSelectors'
import { HooksDependencies } from './components/HooksDependencies'

export default [
  {
    component: App,
    routes: [
      {
        path: '/redux-hooks',
        component: Index,
        exact: true,
      },
      {
        path: '/redux-hooks/named-selectors/:userId',
        component: NamedSelectors,
      },
      {
        path: '/redux-hooks/hooks-dependencies/:userId',
        component: HooksDependencies,
      },
    ],
  },
]
