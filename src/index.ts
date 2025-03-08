import {
  createProxy as createProxyToCompare,
  getUntracked,
  isChanged,
  trackMemo,
} from "proxy-compare";

/**
 * A store that holds a state and actions to update the state.
 *
 * @see {@linkcode create} for how to create a store.
 */
export type Store<
  State extends object,
  Computed extends object,
  Actions extends Record<string, (...args: never) => any>,
> = StoreBase<State, Computed, Actions> & State & Computed & Actions;
export interface StoreBase<
  State extends object,
  Computed extends object,
  Actions extends Record<string, (...args: never) => any>,
> {
  /**
   * Run an action on the store.
   * @param action
   */
  $act<Args extends unknown[], R>(
    action: (
      this: StoreBase<State, Computed, Actions> & Prettify<State & Computed & Actions>,
      ...args: Args
    ) => R,
    args?: Args,
  ): R;

  /**
   * Get the current state of the store.
   * @returns The current state.
   */
  $get(): PrettifyReadonly<State & Computed>;
  /**
   * Get the initial state of the store.
   * @returns The initial state.
   */
  $getInitialState(): PrettifyReadonly<State & Computed>;

  /**
   * Set the state of the store with a new state.
   * @param newState The new state to set.
   */
  $set(newState: Readonly<State>): void;
  /**
   * Set the state of the store using a setter function.
   * @param setter A function that takes the previous state and returns the new state.
   */
  $set(setter: (prevState: Readonly<State>) => State): void;
  /**
   * Patch the state of the store with a partial state.
   * @param newState The partial state to patch.
   */
  $patch(newState: Partial<Readonly<State>>): void;
  /**
   * Patch the state of the store using a patcher function.
   * @param patcher A function that takes the previous state and returns the partial state to patch.
   */
  $patch(patcher: (prevState: Readonly<State>) => Partial<State>): void;
  /**
   * Update the state of the store with mutable-style updates.
   * @param updater A function that takes the state and updates it.
   */
  $update(updater: (state: Prettify<State & Computed>) => void): void;

  /**
   * Subscribe to changes in the store.
   *
   * NOTE: Subscribers are only attempted to be triggered after the next state change rather than
   * immediately upon creation.
   * @param subscriber The function to call when the state changes.
   * @returns A function to unsubscribe from the store.
   */
  $subscribe(
    subscriber: (
      state: PrettifyReadonly<State & Computed>,
      prevState: PrettifyReadonly<State & Computed>,
    ) => void,
  ): () => void;
  /**
   * Subscribe to changes of a selected value in the store.
   *
   * Dependencies are automatically tracked in the selector function, so feel free to use selectors
   * like `(state) => ({ foo: state.foo, bar: state.bar })`.
   *
   * NOTE: Subscribers are only attempted to be triggered after the next state change rather than
   * immediately upon creation.
   * @param selector A function that takes the state and returns the selected value.
   * @param subscriber The function to call when the selected value changes.
   * @returns A function to unsubscribe from the store.
   */
  $subscribe<Selected>(
    selector: (state: PrettifyReadonly<State & Computed>) => Selected,
    subscriber: (value: Selected, prevValue: Selected) => void,
  ): () => void;

  /**
   * Watch for changes in the store and call the watcher function whenever the auto-tracked
   * dependencies change.
   *
   * NOTE: Like subscribers, watchers are only attempted to be triggered after the next state change
   * rather than immediately upon creation. Therefore, avoid using them to trigger side effects that
   * should run immediately.
   * @param watch
   */
  $watch(
    watch: (
      state: PrettifyReadonly<State & Computed>,
      prevState: PrettifyReadonly<State & Computed>,
    ) => void | Promise<void>,
  ): () => void;
}

/**
 * Extract the state type from a {@linkcode Store}.
 */
export type ExtractState<S> =
  S extends (
    Store<
      infer State,
      infer _Computed,
      infer _Actions extends Record<string, (...args: never) => unknown>
    >
  ) ?
    State
  : never;
/**
 * Extract the computed type from a {@linkcode Store}.
 */
export type ExtractComputed<S> =
  S extends (
    Store<
      infer _State,
      infer Computed,
      infer _Actions extends Record<string, (...args: never) => unknown>
    >
  ) ?
    Computed
  : never;
/**
 * Extract the actions type from a {@linkcode Store}.
 */
export type ExtractActions<S> =
  S extends (
    Store<
      infer _State,
      infer _ComputedOptions,
      infer Actions extends Record<string, (...args: never) => unknown>
    >
  ) ?
    Actions
  : never;

/**
 * Create a store.
 * @param slice The initial state, computed states, and actions of the store.
 * @returns
 *
 * @example
 * ```typescript
 * const store = create({
 *   count: 0,
 *   bookshelf: {
 *     books: [
 *       { title: "Refactoring", pages: 448, read: true },
 *       { title: "Clean Code", pages: 464, read: false },
 *     ],
 *   },
 *
 *   // Computed states can be defined via the `get` helper
 *   [get("doubleCount")]() {
 *     return this.count * 2;
 *   },
 *   // Computed states are cached depending on their auto-tracked dependencies
 *   [get("readBooks")]() {
 *     // Re-run only when `bookshelf.books` changes
 *     return this.bookshelf.books.filter((book) => book.read);
 *   },
 *
 *   // Actions are just function properties
 *   incBy(by: number) {
 *     // The state can be mutated via `this`
 *     this.count += by;
 *   },
 *   inc() {
 *     // You can call other actions from within an action
 *     this.incBy(1); // Or `store.incBy(1)`
 *   },
 *   markRead(title: string) {
 *     // You can access computed states in actions (or other computed states)
 *     if (this.readBooks.some((book) => book.title === title)) {
 *       throw new Error("Book already read");
 *     }
 *     this.bookshelf.books.find((book) => book.title === title)?.read = true;
 *   },
 *   addBook(title: string, pages: number) {
 *     const book = { title, pages, read: false };
 *     this.bookshelf.books.push(book);
 *     return book;
 *   },
 * });
 *
 * const state1 = store.$get();
 * // { count: 0, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
 *
 * // Actions are directly accessible on the store
 * // (NOTE: `this` binding is automatically handled, no need to worry about it)
 * store.incBy(2);
 *
 * const state2 = store.$get();
 * // { count: 2, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
 *
 * // Each action creates a new state
 * console.log(state1 === state2); // false
 * console.log(state1); // { count: 0, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
 *
 * // Computed states are cached and only recalculated when their dependencies change
 * console.log(state1.doubleCount === state2.doubleCount); // false
 * console.log(state1.readBooks === state2.readBooks); // true
 *
 * // Subscribe to changes
 * const unsubscribe = store.$subscribe((state, prevState) => {
 *   console.log("State changed\nfrom:", prevState, "\nto:", state);
 * });
 *
 * store.inc();
 * // State changed
 * // from: { count: 2, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
 * // to: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
 * store.addBook("JavaScript: The Definitive Guide", 706);
 * // State changed
 * // from: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
 * // to: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
 * store.markRead("JavaScript: The Definitive Guide");
 * // State changed
 * // from: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
 * // to: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
 * ```
 *
 * @see {@linkcode slice} for how to create a store with slices.
 * @see {@linkcode useStore} and {@linkcode hookify} for how to use this store in a React component.
 */
export function create<Slice extends object>(
  slice: Slice &
    ThisType<
      StoreBase<
        Prettify<ExtractSliceState<Slice>>,
        Prettify<ExtractSliceComputed<Slice>>,
        Prettify<ExtractSliceActions<Slice>>
      > &
        Prettify<
          ExtractSliceState<Slice> & ExtractSliceComputed<Slice> & ExtractSliceActions<Slice>
        >
    >,
): Store<
  Prettify<ExtractSliceState<Slice>>,
  Prettify<ExtractSliceComputed<Slice>>,
  Prettify<ExtractSliceActions<Slice>>
> {
  type State = ExtractSliceState<Slice>;
  type Computed = ExtractSliceComputed<Slice>;
  type ComputedOptions = { [K in keyof Computed]: () => Computed[K] };
  type Actions = ExtractSliceActions<Slice>;

  type ComputedState = State & Computed;

  readonly(slice, true);

  const initialState = {} as State;
  const computed = {} as ComputedOptions;
  const actions = {} as Actions;

  for (const key of Reflect.ownKeys(slice)) {
    const descriptor = Object.getOwnPropertyDescriptor(slice, key)!;

    if (
      typeof key === "string" &&
      key.startsWith(getterNamePrefix) &&
      typeof descriptor.value === "function"
    ) {
      Object.defineProperty(computed, key.slice(getterNamePrefix.length), {
        value: descriptor.value,
        enumerable: true,
      });
      continue;
    }

    if (typeof descriptor.value === "function") {
      Object.defineProperty(actions, key, descriptor);
      continue;
    }

    Object.defineProperty(initialState, key, descriptor);
  }

  let _state = initialState;
  let _computedState!: ComputedState;

  const listeners = new Set<(state: ComputedState, prevState: ComputedState) => void>();
  const setState = (state: State) => {
    if (Object.is(state, _state)) return;
    const prevState = _computedState;
    _state = state;
    _computedState = snapshotComputedState(state);
    for (const listener of listeners) listener(_computedState, prevState);
  };

  let inAction = false;
  let mutationCache = new WeakMap<object, Record<string | symbol, ["set", unknown] | ["del"]>>();
  const flushCache = new WeakMap<object, object>();
  const getFlushed = <T = State>(obj: T = _state as T): T => {
    if (!isObject(obj)) return obj;
    const mutations = mutationCache.get(obj);
    if (!mutations) return obj;
    if (!mutations[DIRTY_SYMBOL]) return flushCache.get(obj) as T;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete mutations[DIRTY_SYMBOL];
    const newObj: any = Array.isArray(obj) ? [] : {};
    flushCache.set(obj, newObj);
    for (const key of new Set(Reflect.ownKeys(obj).concat(Reflect.ownKeys(mutations)))) {
      if (key in mutations) {
        const [type, value] = mutations[key]!;
        if (type === "set") {
          const desc = Reflect.getOwnPropertyDescriptor(obj, key);
          if (desc) {
            desc.value = readonly(value, true) as never;
            Object.defineProperty(newObj, key, desc);
          } else {
            Object.defineProperty(newObj, key, {
              value: readonly(value, true),
              enumerable: true,
              configurable: true,
            });
          }
        }
        continue;
      }
      if (Object.getOwnPropertyDescriptor(newObj, key))
        // Only the known case is Array.length so far.
        continue;
      const desc = Reflect.getOwnPropertyDescriptor(obj, key)!;
      if ("value" in desc && desc.configurable) desc.value = getFlushed(Reflect.get(obj, key));
      Object.defineProperty(newObj, key, desc);
    }
    return newObj;
  };
  const flushMutations = () => {
    if (!mutationCache.has(_state)) return;
    setState(getFlushed());
    mutationCache = new WeakMap();
  };

  const getInitialState = () => _initialComputedState;

  const computedCache = new Map<
    string,
    { state: State; affected: Affected; cachedResult: unknown }
  >();

  const getComputedThis = (computedState: ComputedState, stateProxy: State) => {
    const get = () => computedState;
    const thisArg = { $get: get, $getInitialState: getInitialState };
    for (const key of Reflect.ownKeys(computedState)) {
      const desc = Reflect.getOwnPropertyDescriptor(computedState, key)!;
      if (desc.get) {
        Reflect.defineProperty(thisArg, key, desc);
      } else {
        desc.get = () => (stateProxy as any)[key];
        delete desc.value;
        delete desc.writable;
        Reflect.defineProperty(thisArg, key, desc);
      }
    }
    for (const key in actions) {
      const handler = actions[key];
      const fn = renameFunction((...args: never) => handler.apply(thisArg, args), "key");
      (thisArg as any)[key] = fn;
    }
    return thisArg;
  };

  const snapshotCache = new WeakMap<object, ComputedState>();
  const snapshotComputedState = (state: State) => {
    if (snapshotCache.has(state)) return snapshotCache.get(state)!;
    const computedState = { ...state } as ComputedState;
    snapshotCache.set(state, computedState);

    const cache = new Map<string, { state: State; affected: Affected; cachedResult: unknown }>();
    for (const [key, { affected, cachedResult, state: prevState }] of computedCache)
      if (!isChanged(prevState, state, affected, new WeakMap(), isOriginalEqual)) {
        touchAffected(state, prevState, affected);
        cache.set(key, { state: prevState, affected, cachedResult });
      }

    for (const key in computed) {
      const getter = computed[key];
      Object.defineProperty(computedState, key, {
        get: () => {
          if (cache.has(key)) {
            const { affected, cachedResult, state: prevState } = cache.get(key)!;
            touchAffected(state, prevState, affected);
            if (activeStateProxies.length)
              touchAffected(activeStateProxies[activeStateProxies.length - 1], prevState, affected);
            return cachedResult;
          }

          if (computedCache.has(key)) {
            const { affected, cachedResult, state: prevState } = computedCache.get(key)!;
            if (!isChanged(prevState, state, affected, new WeakMap(), isOriginalEqual)) {
              touchAffected(state, prevState, affected);
              if (activeStateProxies.length)
                touchAffected(
                  activeStateProxies[activeStateProxies.length - 1],
                  prevState,
                  affected,
                );
              cache.set(key, { state, affected, cachedResult });
              return cachedResult;
            }
          }

          const affected: Affected = new WeakMap();
          const proxy = createProxyToCompare(state, affected, undefined, targetCache);
          activeStateProxies.push(proxy);
          const thisArg = getComputedThis(computedState, proxy);
          const value = untrack(getter.call(thisArg));
          activeStateProxies.pop();
          touchAffected(state, state, affected);
          if (activeStateProxies.length)
            touchAffected(activeStateProxies[activeStateProxies.length - 1], state, affected);
          // Update to global cache if cache is empty or `state` is still the latest
          // (to avoid corrupt latest computed cache)
          if (
            !computedCache.has(key) ||
            !isChanged(state, getFlushed(), affected, new WeakMap(), isOriginalEqual)
          )
            computedCache.set(key, { state, affected, cachedResult: value });
          cache.set(key, { state, affected, cachedResult: value });
          return value;
        },
        enumerable: true,
        configurable: true,
      });
    }

    return computedState;
  };

  const _initialComputedState = snapshotComputedState(initialState);
  _computedState = _initialComputedState;

  /* Base store methods */
  const act = <R>(action: (...args: never) => R, args: unknown[] = []): R => {
    if (inAction) return action.apply(proxiedStore, args as never);
    inAction = true;
    const result = action.apply(proxiedStore, args as never);
    flushMutations();
    inAction = false;
    return result;
  };

  const get = () => _computedState;

  const set = (newStateOrSetter: State | ((prevState: State) => State)) => {
    if (typeof newStateOrSetter === "function") setState(newStateOrSetter(_state));
    else setState(newStateOrSetter);
  };
  const patch = (newStateOrPatcher: Partial<State> | ((prevState: State) => Partial<State>)) => {
    if (typeof newStateOrPatcher === "function") {
      const patcher = newStateOrPatcher as (prevState: State) => Partial<State>;
      setState({ ..._state, ...patcher(_state) });
      return;
    }
    setState({ ..._state, ...newStateOrPatcher });
  };
  const update = (updater: (state: ComputedState) => void) => {
    act(() => updater.call(undefined, proxiedStore as never));
  };

  const subscribe = <Selected>(
    selectorOrSubscriber:
      | ((state: ComputedState) => Selected)
      | ((value: Selected, prevValue: Selected) => void),
    subscriber?: (value: Selected, prevValue: Selected) => void,
  ) => {
    let selector: (state: ComputedState) => Selected =
      subscriber === undefined ? (state) => state as any : (selectorOrSubscriber as any);
    if (typeof selector !== "function")
      throw new TypeError("The selector to $subscribe must be a function.");
    if (subscriber !== undefined) selector = memoizeSelector(selector);
    if (subscriber === undefined) subscriber = selectorOrSubscriber as any;
    if (typeof subscriber !== "function")
      throw new TypeError("The subscriber to $subscribe must be a function.");

    const listener = (state: ComputedState, prevState: ComputedState) => {
      const newValue = selector(state);
      const prevValue = selector(prevState);
      if (!Object.is(newValue, prevValue)) subscriber(newValue, prevValue);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const watch = (
    watcher: (state: ComputedState, prevState: ComputedState) => void | Promise<void>,
  ) => {
    if (typeof watcher !== "function")
      throw new TypeError("The watcher to $watch must be a function.");

    let _prevState: ComputedState;
    const fn = memoizeSelector((state: ComputedState) => watcher(state, _prevState));
    const listener = (state: ComputedState, prevState: ComputedState) => {
      _prevState = prevState;
      void fn(state);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const store = {
    $act: act,

    $get: get as never,
    $getInitialState: getInitialState as never,

    $set: set as never,
    $patch: patch as never,
    $update: update as never,

    $subscribe: subscribe,

    $watch: watch as never,
  } satisfies StoreBase<State, Computed, Actions>;

  /* Actions */
  const helperMethodNames = new Set(Object.keys(store));
  const computedNames = new Set(Object.keys(computed));
  const actionNames = new Set(Object.keys(actions));

  const proxyCache = new WeakMap<object, object>();
  const childrenCache = new WeakMap<object, Record<string | symbol, object>>();
  const parentsCache = new WeakMap<object, Set<object>>();

  const unlinkCache = (target: object, prop: string | symbol) => {
    const children = childrenCache.get(target);
    if (children) {
      const child = children[prop];
      if (child) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete children[prop];
        const childParents = parentsCache.get(child);
        if (childParents) childParents.delete(target);
      }
    }
  };

  const markDirty = (target: object) => {
    if (!mutationCache.has(target)) mutationCache.set(target, {});
    (mutationCache.get(target) as any)[DIRTY_SYMBOL] = true;
    const parents = parentsCache.get(target);
    if (!parents) return;
    parents.forEach(markDirty);
  };

  const proxy = <T extends object>(target: T): T => {
    const cached = proxyCache.get(target);
    if (cached) return cached as T;
    const proxy = new Proxy(target, createHandler(target));
    proxyCache.set(target, proxy);
    return proxy;
  };

  const createHandler = <T extends object>(target: T): ProxyHandler<T> => {
    const handler: ProxyHandler<T> = {
      get: (_, prop) => {
        const desc = Reflect.getOwnPropertyDescriptor(target, prop);
        if (desc && !("value" in desc) && !desc.writable && !desc.configurable)
          return Reflect.get(target, prop);
        const mutations = mutationCache.get(target);
        if (!mutations || !(prop in mutations)) {
          const value = Reflect.get(target, prop);
          if (!canProxy(value)) return value;
          const children = childrenCache.get(target) || {};
          children[prop] = value;
          childrenCache.set(target, children);
          const valueParents = parentsCache.get(value) || new Set();
          valueParents.add(target);
          parentsCache.set(value, valueParents);
          return proxy(value);
        }
        const [type, value] = mutations[prop]!;
        return type === "set" ? value : undefined;
      },

      has: (_, prop) => {
        const mutations = mutationCache.get(target);
        if (!mutations || !(prop in mutations)) return prop in target;
        return mutations[prop]![0] === "set";
      },

      getOwnPropertyDescriptor: (_, prop) => {
        const mutations = mutationCache.get(target);
        if (!mutations || !(prop in mutations))
          return Reflect.getOwnPropertyDescriptor(target, prop);
        const [type, value] = mutations[prop]!;
        if (type === "set") {
          const desc = Reflect.getOwnPropertyDescriptor(target, prop);
          if (desc) {
            desc.value = value as never;
            return desc;
          }
          return { value, enumerable: true, configurable: true };
        }
        return undefined;
      },

      ownKeys: () => {
        const mutations = mutationCache.get(target);
        if (!mutations) return Reflect.ownKeys(target);
        const keys = new Set(Reflect.ownKeys(target));
        for (const key of Reflect.ownKeys(mutations)) {
          if (key === DIRTY_SYMBOL) continue;
          const [type] = mutations[key]!;
          keys[type === "set" ? "add" : "delete"](key);
        }
        return Array.from(keys);
      },

      set: (_, prop, value) => {
        const desc = Reflect.getOwnPropertyDescriptor(target, prop);
        if (desc && !desc.writable && !desc.configurable) return false;
        const mutations = mutationCache.get(target) || {};
        const setValue = (value: unknown) => {
          unlinkCache(target, prop);
          mutations[prop] = ["set", value];
          mutationCache.set(target, mutations);
          markDirty(target);
          if (!inAction) flushMutations();
        };
        const prevMutation = mutations[prop];
        if (prevMutation) {
          const [type, prevValue] = prevMutation;
          if (type === "set" && Object.is(prevValue, value)) return true;
          setValue(value);
          return true;
        }
        if (desc && !("value" in desc)) {
          if (!("set" in desc)) return true;
          desc.set!.call(handler, value);
          return true;
        }
        if (desc && desc.value === value) return true;
        setValue(value);
        return true;
      },

      deleteProperty: (_, prop) => {
        const desc = Reflect.getOwnPropertyDescriptor(target, prop);
        if (desc && !desc.configurable) return false;
        const mutations = mutationCache.get(target) || {};
        const prevMutation = mutations[prop];
        if (!desc || (prevMutation && prevMutation[0] === "del")) return true;
        unlinkCache(target, prop);
        mutationCache.set(target, mutations);
        markDirty(target);
        mutations[prop] = ["del"];
        if (!inAction) flushMutations();
        return true;
      },
    };
    return handler;
  };

  const proxiedStore = new Proxy(store, {
    get: (_, prop) => {
      if (prop in store) return store[prop as keyof typeof store];

      if (typeof prop === "string" && computedNames.has(prop)) {
        const cache = computedCache.get(prop);
        const state = getFlushed();
        if (
          cache &&
          !isChanged(cache.state, state, cache.affected, new WeakMap(), isOriginalEqual)
        ) {
          // Touch proxied state to create potential uncreated proxies
          touchAffected(proxy(state), cache.state, cache.affected);
          return canProxy(cache.cachedResult) ? proxy(cache.cachedResult) : cache.cachedResult;
        }
        const affected: Affected = new WeakMap();
        const proxyToCompare = createProxyToCompare(state, affected, undefined, targetCache);
        activeStateProxies.push(proxyToCompare);
        const thisArg = getComputedThis(_computedState, proxyToCompare);
        const value = untrack(computed[prop as keyof Computed].call(thisArg));
        activeStateProxies.pop();
        // Touch proxied state to create potential uncreated proxies
        touchAffected(proxy(state), state, affected);
        computedCache.set(prop, { state, affected, cachedResult: value });
        return canProxy(value) ? proxy(value) : value;
      }

      return proxy(_state)[prop as keyof State];
    },

    has: (_, prop) => {
      if (prop in store) return true;
      if (typeof prop === "string" && computedNames.has(prop)) return true;
      if (mutationCache.has(_state)) return prop in proxy(_state);
      return prop in _state;
    },

    getOwnPropertyDescriptor: (_, prop) => {
      if (prop in store) return Reflect.getOwnPropertyDescriptor(store, prop);
      if (typeof prop === "string" && computedNames.has(prop))
        return Reflect.getOwnPropertyDescriptor(_computedState, prop);
      if (mutationCache.has(_state)) return Reflect.getOwnPropertyDescriptor(proxy(_state), prop);
      return Reflect.getOwnPropertyDescriptor(_state, prop);
    },

    ownKeys: () => {
      const keys = Array.from(helperMethodNames);
      Array.prototype.push.apply(
        keys,
        Reflect.ownKeys(mutationCache.has(_state) ? proxy(_state) : _state),
      );
      Array.prototype.push.apply(keys, Array.from(computedNames));
      Array.prototype.push.apply(keys, Array.from(actionNames));
      return keys;
    },

    set: (_, prop, value) => {
      if (prop in store || (typeof prop === "string" && computedNames.has(prop))) return false;
      return Reflect.set(proxy(_state), prop, value);
    },

    deleteProperty: (_, prop) => {
      if (prop in store || (typeof prop === "string" && computedNames.has(prop))) return false;
      return Reflect.deleteProperty(proxy(_state), prop);
    },
  });

  for (const key in actions) {
    const handler = actions[key];
    (store as any)[key] = renameFunction((...args: never) => act(handler, args), key);
  }

  readonly(store, false);
  return proxiedStore as any;
}

/*********
 * Slice *
 *********/
export const getterNamePrefix = "troza/getter:";
export type GetterNamePrefix = typeof getterNamePrefix;

/**
 * Create a getter name.
 * @param name The name of the getter.
 * @returns
 */
export function get<Name extends string>(name: Name): GetterName<Name> {
  return `${getterNamePrefix}${name}`;
}
export type GetterName<Name extends string = string> = `${GetterNamePrefix}${Name}`;

/**
 * Force TypeScript to evaluate {@linkcode T} eagerly.
 *
 * This is just used to make type information more readable on hover.
 */
type Prettify<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;
type PrettifyReadonly<T> = T extends infer U ? { readonly [K in keyof U]: U[K] } : never;

export type ExtractSliceState<Slice extends object> = {
  [K in keyof Slice as K extends GetterName ? never
  : Slice[K] extends (...args: never) => any ? never
  : K]: Slice[K];
};
export type ExtractSliceComputed<Slice extends object> = {
  readonly [K in keyof Slice as K extends GetterName<infer Name> ?
    Slice[K] extends () => any ?
      Name
    : never // Filter out invalid getters
  : never]: Slice[K] extends (...args: never) => infer R ? R
  : // This should never happen, as we already filtered out invalid getters in name
    never;
};
export type ExtractSliceActions<Slice extends object> = {
  readonly [K in keyof Slice as K extends GetterName ? never
  : Slice[K] extends (...args: never) => any ? K
  : never]: Slice[K] extends (...args: never) => any ? Slice[K] : never;
};

/**
 * Create a slice for a store.
 *
 * This function just returns the input slice as is, but it is useful for type inference.
 * @param slice The slice for the store.
 * @returns
 *
 * @example
 * ```typescript
 * import { create, get, slice } from "troza";
 *
 * const counterSlice = slice({
 *   count: 0,
 *   [get("doubleCount")]() {
 *     return this.count * 2;
 *   },
 *   inc() {
 *     this.count++;
 *   },
 * });
 *
 * const nameSlice = slice({
 *   name: "John Doe",
 *   changeName(name: string) {
 *     this.name = name;
 *   },
 * });
 *
 * const store = create({ ...counterSlice, ...nameSlice });
 * ```
 */
export function slice<Slice extends object>(
  slice: Slice &
    ThisType<
      StoreBase<
        Prettify<ExtractSliceState<Slice>>,
        Prettify<ExtractSliceComputed<Slice>>,
        Prettify<ExtractSliceActions<Slice>>
      > &
        Prettify<
          ExtractSliceState<Slice> & ExtractSliceComputed<Slice> & ExtractSliceActions<Slice>
        >
    >,
): Slice {
  return slice;
}

/**********************
 * Internal utilities *
 **********************/
/**
 * Rename a function for better debugging experience.
 * @private
 * @param fn The function to rename.
 * @param name The new name for the function.
 * @returns The renamed function.
 */
const renameFunction = <F extends (...args: never) => unknown>(fn: F, name: string): F =>
  Object.defineProperty(fn, "name", {
    value: name,
    configurable: true,
  });

const DIRTY_SYMBOL = Symbol();

const canProxy = (x: unknown): x is object =>
  x !== null &&
  typeof x === "object" &&
  (Array.isArray(x) || (!(Symbol.iterator in x) && Object.getPrototypeOf(x) === Object.prototype));

/**
 * Make an object readonly, but allowing for configuration.
 *
 * Inspired by Valtio: https://github.com/pmndrs/valtio/blob/75097c8fb2dd8080123808adc2ad11f0a6f7fc82/src/vanilla.ts#L70-L102
 * @private
 * @param target The object to clone.
 * @param deep Whether to clone deeply.
 * @param preventExtensions Whether to prevent extensions.
 * @param visited A weak map to handle circular references.
 * @returns The target itself.
 */
const readonly = <T>(target: T, deep: boolean, visited = new WeakSet()): T => {
  if (!canProxy(target)) return target;
  // Handle circular references
  if (visited.has(target)) return target;
  visited.add(target);
  for (const key of Reflect.ownKeys(target)) {
    const desc = Reflect.getOwnPropertyDescriptor(target, key)!;
    if (!desc.configurable) continue;
    if (deep && desc.value && canProxy(desc.value)) readonly(desc.value, true, visited);
    if (!desc.writable) continue;
    desc.writable = false;
    Object.defineProperty(target, key, desc);
  }
  return target;
};

/* Auto-tracked memoization */
const activeStateProxies: object[] = [];

/**
 * Memoize a function that takes a state object and returns a result.
 *
 * Works the same as `memoize` in [proxy-memoize](https://github.com/dai-shi/proxy-memoize) when the
 * cache size is limited to 1, but also tracks computed states.
 *
 * This is primarily used to memoize selectors in this library.
 *
 * @param fn The function to memoize.
 * @returns The memoized function.
 */
export function memoizeSelector<State extends object, R>(fn: (state: State) => R) {
  let cache = null as { state: State; affected: Affected; cachedResult: R } | null;
  return (state: State) => {
    if (cache) {
      const { affected, cachedResult, state: prevState } = cache;
      if (!isChanged(prevState, state, affected, new WeakMap(), isOriginalEqual)) {
        touchAffected(state, prevState, affected);
        return cachedResult;
      }
    }
    const affected: Affected = new WeakMap();
    const proxy = createProxyToCompare(state, affected, undefined, targetCache);
    activeStateProxies.push(proxy);
    const result = untrack(fn(proxy));
    activeStateProxies.pop();
    touchAffected(state, state, affected);
    cache = { state, affected, cachedResult: result };
    return result;
  };
}

//------------------------------------------------------------------------------
// The following code snippet is copied from proxy-memoize
// https://github.com/dai-shi/proxy-memoize/blob/cd2bdfecb3ff2a5389063fea7504a8f264c6ec68/src/memoize.ts

// This is required only for performance.
// https://github.com/dai-shi/proxy-memoize/issues/68
const targetCache = new WeakMap();

// constants from proxy-compare
const HAS_KEY_PROPERTY = "h";
const ALL_OWN_KEYS_PROPERTY = "w";
const HAS_OWN_KEY_PROPERTY = "o";
const KEYS_PROPERTY = "k";

type HasKeySet = Set<string | symbol>;
type HasOwnKeySet = Set<string | symbol>;
type KeysSet = Set<string | symbol>;
type Used = {
  [HAS_KEY_PROPERTY]?: HasKeySet;
  [ALL_OWN_KEYS_PROPERTY]?: true;
  [HAS_OWN_KEY_PROPERTY]?: HasOwnKeySet;
  [KEYS_PROPERTY]?: KeysSet;
};
type Affected = WeakMap<object, Used>;

const trackMemoUntrackedObjSet = new WeakSet();

const isObject = (x: unknown): x is object => typeof x === "object" && x !== null;

/**
 * Untrack a proxy object in [proxy-compare](https://github.com/dai-shi/proxy-compare).
 * @private
 * @param value The value to untrack.
 * @param seen A weak set to keep track of visited objects to avoid circular references.
 * @returns The untracked value.
 */
const untrack = <T>(x: T, seen: WeakSet<object> = new WeakSet()): T => {
  if (!isObject(x)) return x;
  const untrackedObj = getUntracked(x);
  if (untrackedObj) {
    trackMemo(x);
    trackMemoUntrackedObjSet.add(untrackedObj);
    return untrackedObj;
  }
  if (!seen.has(x)) {
    seen.add(x);
    for (const k in x) {
      const v = x[k as keyof T];
      const vv = untrack(v, seen);
      if (!Object.is(vv, v)) x[k as keyof T] = vv;
    }
  }
  return x;
};

const touchAffected = (dst: unknown, src: unknown, affected: Affected) => {
  if (!isObject(dst) || !isObject(src)) return;
  const untrackedObj = getUntracked(src);
  const used = affected.get(untrackedObj || src);
  if (!used) {
    if (trackMemoUntrackedObjSet.has(untrackedObj as never)) trackMemo(dst);
    return;
  }
  for (const key of used[HAS_KEY_PROPERTY] || []) Reflect.has(dst, key);
  if (used[ALL_OWN_KEYS_PROPERTY] === true) Reflect.ownKeys(dst);
  for (const key of used[HAS_OWN_KEY_PROPERTY] || []) Reflect.getOwnPropertyDescriptor(dst, key);
  for (const key of used[KEYS_PROPERTY] || [])
    touchAffected(dst[key as keyof typeof dst], src[key as keyof typeof src], affected);
};

const isOriginalEqual = (x: unknown, y: unknown): boolean => {
  for (let xx = x; xx; x = xx, xx = getUntracked(xx));
  for (let yy = y; yy; y = yy, yy = getUntracked(yy));
  return Object.is(x, y);
};
