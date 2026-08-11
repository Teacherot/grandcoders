import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { queryDemoCollection, getDemoFunctionResult } from '@/lib/demoData';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const isDemoMode = () => {
  if (typeof window === 'undefined') return true;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0' || window.localStorage.getItem('demo_login') === 'true';
};

const createFallbackEntityApi = () => ({
  list: async (sortField = '', limit = 100) => {
    if (!isDemoMode()) return [];
    return queryDemoCollection('orders', {}, sortField, limit);
  },
  filter: async (query = {}, sortField = '', limit = 100) => {
    if (!isDemoMode()) return [];
    const collectionName = Object.keys(query || {}).find((key) => ['agent_id', 'agentId'].includes(key)) ? 'orders' : 'orders';
    return queryDemoCollection(collectionName, query, sortField, limit);
  },
});

const entityProxy = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'list' || prop === 'filter') {
      return (...args) => createFallbackEntityApi()[prop](...args);
    }
    return new Proxy(function () {}, {
      get(_nestedTarget, nestedProp) {
        if (nestedProp === 'list' || nestedProp === 'filter') {
          return (...args) => createFallbackEntityApi()[nestedProp](...args);
        }
        return async (...args) => {
          if (!isDemoMode()) return [];
          const collectionName = String(prop).toLowerCase();
          return queryDemoCollection(collectionName, args[0] || {}, args[1] || '', args[2] || 100);
        };
      },
    });
  },
});

const delegateClient = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

const safeInvoke = async (name, payload = {}) => {
  if (!isDemoMode()) {
    return delegateClient.functions.invoke(name, payload);
  }
  return getDemoFunctionResult(name, payload);
};

export const base44 = new Proxy(delegateClient, {
  get(target, prop) {
    if (prop === 'functions') {
      return new Proxy(target.functions, {
        get(fnTarget, fnProp) {
          if (fnProp === 'invoke') return safeInvoke;
          return Reflect.get(fnTarget, fnProp);
        },
      });
    }
    if (prop === 'entities') {
      return entityProxy;
    }
    return Reflect.get(target, prop);
  },
});
