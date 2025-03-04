import type { Draft } from "immer";
import { Immer, current, isDraft } from "immer";
import { createProxy, getUntracked, isChanged, trackMemo } from "proxy-compare";

/**
 * Force TypeScript to evaluate {@linkcode T} eagerly.
 *
 * This is just used to make type information more readable on hover.
 */
type Prettify<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

export type ComputedOptions = Record<
  string,
  // The usage of `any` as return type here is intentional to avoid circular type references.
  // Don’t try to replace with `unknown`.
  // Quite ridiculous, isn’t it? Sometimes seemingly same things are not the same in TypeScript.
  () => any
>;
export type ExtractComputedReturns<Computed extends ComputedOptions> = {
  readonly [K in keyof Computed as Computed[K] extends (...args: never) => unknown ? K
  : never]: Computed[K] extends (...args: never) => infer R ? R : never;
};

/**
 * A store that holds a state and actions to update the state.
 *
 * @see {@linkcode createStore} for how to create a store.
 */
export type Store<
  State extends object,
  Computed extends ComputedOptions,
  Actions extends Record<string, (...args: never) => unknown>,
> = StoreBase<State, Computed> & Readonly<Actions>;
export interface ReadonlyStoreBase<State extends object, Computed extends ComputedOptions> {
  /**
   * Get the current state of the store.
   * @returns The current state.
   */
  $get(): Readonly<State & ExtractComputedReturns<Computed>>;
  /**
   * Get the initial state of the store.
   * @returns The initial state.
   */
  $getInitialState(): Readonly<State & ExtractComputedReturns<Computed>>;
}
export interface StoreBase<State extends object, Computed extends ComputedOptions>
  extends ReadonlyStoreBase<State, Computed> {
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
   * Update the state of the store using an updater function.
   * @param updater A function that takes the immer draft of the state and updates it.
   */
  $update(updater: (draft: Draft<State>) => void): void;

  /**
   * Subscribe to changes in the store.
   * @param subscriber The function to call when the state changes.
   * @returns A function to unsubscribe from the store.
   */
  $subscribe(
    subscriber: (
      state: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>,
      prevState: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>,
    ) => void,
  ): () => void;
  /**
   * Subscribe to changes of a selected value in the store.
   *
   * Dependencies are automatically tracked in the selector function, so feel free to use selectors
   * like `(state) => ({ foo: state.foo, bar: state.bar })`.
   * @param selector A function that takes the state and returns the selected value.
   * @param subscriber The function to call when the selected value changes.
   * @returns A function to unsubscribe from the store.
   */
  $subscribe<Selected>(
    selector: (state: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>) => Selected,
    subscriber: (value: Selected, prevValue: Selected) => void,
  ): () => void;

  $watch(
    watch: (
      state: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>,
      prevState: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>,
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
      infer _ComputedOptions,
      infer _Actions extends Record<string, (...args: never) => unknown>
    >
  ) ?
    State
  : never;
/**
 * Extract the computed options type from a {@linkcode Store}.
 */
export type ExtractComputedOptions<S> =
  S extends (
    Store<
      infer _State,
      infer ComputedOptions,
      infer _Actions extends Record<string, (...args: never) => unknown>
    >
  ) ?
    ComputedOptions
  : never;
/**
 * Extract the computed type from a {@linkcode Store}.
 */
export type ExtractComputed<S> =
  S extends (
    Store<
      infer _State,
      infer ComputedOptions,
      infer _Actions extends Record<string, (...args: never) => unknown>
    >
  ) ?
    ExtractComputedReturns<ComputedOptions>
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
 * const store = createStore({
 *   // All properties other than `computed` and `actions` are considered part of the state
 *   // Initial values are set here
 *   count: 0,
 *   bookshelf: {
 *     books: [
 *       { title: "Refactoring", pages: 448, read: true },
 *       { title: "Clean Code", pages: 464, read: false },
 *     ],
 *   },
 *
 *   // Computed states goes into the `computed` property
 *   computed: {
 *     doubleCount() {
 *       return this.count * 2;
 *     },
 *     // Computed states are cached depending on their auto-tracked dependencies
 *     readBooks() {
 *       // Re-run only when `bookshelf.books` changes
 *       return this.bookshelf.books.filter((book) => book.read);
 *     },
 *   },
 *
 *   // All actions go into the `actions` property
 *   actions: {
 *     incBy(by: number) {
 *       // The immer draft of the state is accessible as `this`
 *       this.count += by;
 *     },
 *     inc() {
 *       // You can call other actions from within an action
 *       this.incBy(1); // Or `store.incBy(1)`
 *     },
 *     markRead(title: string) {
 *       // You can access computed states in actions (or other computed states)
 *       if (this.readBooks.some((book) => book.title === title)) {
 *         throw new Error("Book already read");
 *       }
 *       const book = this.bookshelf.books.find((book) => book.title === title);
 *       if (book) book.read = true;
 *     },
 *     addBook(title: string, pages: number) {
 *       const book = { title, pages, read: false };
 *       // The immer draft of the state is accessible as `this`
 *       this.bookshelf.books.push(book);
 *       // You can return a value from an action,
 *       // which is especially useful for async operations
 *       return book;
 *     },
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
 * // Each action creates a new state with immer
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
 * @see {@linkcode createSlice} for how to create a store with slices.
 * @see {@linkcode useStore} and {@linkcode hookify} for how to use this store in a React component.
 */
export function createStore<
  State extends object,
  Computed extends ComputedOptions = {},
  Actions extends Record<string, (...args: never) => unknown> = {},
>(
  slice: State & {
    computed?: Computed &
      ThisType<
        ReadonlyStoreBase<Prettify<Omit<State, "computed" | "actions">>, Computed> &
          Prettify<
            Readonly<
              Omit<State, "computed" | "actions"> &
                ExtractComputedReturns<Computed> & {
                  [K in keyof Actions]: Actions[K];
                }
            >
          >
      >;
    actions?: Actions &
      ThisType<
        StoreBase<Prettify<Omit<State, "computed" | "actions">>, Computed> &
          Prettify<
            Omit<State, "computed" | "actions"> &
              ExtractComputedReturns<Computed> & {
                readonly [K in keyof Actions]: Actions[K];
              }
          >
      >;
  },
): Store<Prettify<Omit<State, "computed" | "actions">>, Computed, Actions> {
  type ComputedState = Readonly<State & ExtractComputedReturns<Computed>>;

  const { actions: _actions, computed: _computed, ...initialState } = slice;
  const computed = _computed || ({} as Computed);
  const actions = _actions || ({} as Actions);

  let _state = initialState as Readonly<State>;
  let _computedState!: ComputedState;
  let _draft: Draft<State> | null = null;

  const getInitialState = () => _initialComputedState;

  const listeners = new Set<
    (
      state: Readonly<State & ExtractComputedReturns<Computed>>,
      prevState: Readonly<State & ExtractComputedReturns<Computed>>,
    ) => void
  >();

  const setState = (state: State) => {
    if (Object.is(state, _state)) return;
    const prevState = _computedState;
    _state = state;
    _computedState = snapshotComputedState(state);
    for (const listener of listeners) listener(_computedState, prevState);
  };

  const computedCache = new Map<
    string,
    { state: Readonly<State>; affected: Affected; cachedResult: unknown }
  >();

  const getComputedThis = (computedState: ComputedState, stateProxy?: State) => {
    const get = () => computedState;
    const thisArg = { $get: get, $getInitialState: getInitialState };
    for (const key of Reflect.ownKeys(computedState)) {
      const descriptor = Reflect.getOwnPropertyDescriptor(computedState, key)!;
      if (!stateProxy || descriptor.get) {
        Reflect.defineProperty(thisArg, key, descriptor);
      } else {
        const desc = { ...descriptor, get: () => (stateProxy as any)[key] };
        delete desc.value;
        delete desc.writable;
        Reflect.defineProperty(thisArg, key, desc);
      }
    }
    for (const key in actions) {
      const handler = actions[key]!;
      const fn = renameFunction((...args: never) => handler.apply(thisArg, args), "key");
      (thisArg as any)[key] = fn;
    }
    return thisArg;
  };

  const snapshotComputedState = (state: State) => {
    const computedState = { ...state } as ComputedState;

    const cache = new Map<string, { state: State; affected: Affected; cachedResult: unknown }>();
    for (const [key, { affected, cachedResult, state: prevState }] of computedCache)
      if (!isChanged(prevState, state, affected, new WeakMap(), isOriginalEqual)) {
        touchAffected(state, prevState, affected);
        cache.set(key, { state: prevState, affected, cachedResult });
      }

    for (const key in computed) {
      const getter = computed[key]!;
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
          const proxy = createProxy(state, affected, undefined, targetCache);
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
            !isChanged(
              state,
              _draft ? current(_draft) : _state,
              affected,
              new WeakMap(),
              isOriginalEqual,
            )
          )
            computedCache.set(key, { state, affected, cachedResult: value });
          cache.set(key, { state, affected, cachedResult: value });
          return value;
        },
        enumerable: true,
      });
    }

    return computedState;
  };

  const _initialComputedState = snapshotComputedState(initialState as State);
  _computedState = _initialComputedState;

  /* Base store methods */
  const get = () => _computedState;

  const set = (newStateOrSetter: State | ((prevState: State) => State)) => {
    if (typeof newStateOrSetter === "function") setState(newStateOrSetter(_state));
    else setState(newStateOrSetter);
  };
  const update = (updater: (draft: Draft<State>) => void) => {
    setState(
      produce(_state, (draft) => {
        updater(draft);
      }),
    );
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
    const fn = memoizeSelector((state: ComputedState) => watcher(state, _prevState!));
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
    $get: get,
    $getInitialState: getInitialState,

    $set: set,
    $update: update,

    $subscribe: subscribe,

    $watch: watch as never,
  } satisfies StoreBase<State, Computed>;

  /* Actions */
  const helperMethodNames = new Set(Object.keys(store));
  const computedNames = new Set(Object.keys(computed));
  const actionNames = new Set(Object.keys(actions));

  const thisArg = new Proxy(
    {},
    {
      get: (_, prop, receiver) => {
        if (typeof prop === "string" && (helperMethodNames.has(prop) || actionNames.has(prop)))
          return (store as any)[prop];

        if (typeof prop === "string" && computedNames.has(prop)) {
          const cache = computedCache.get(prop);
          const state = _draft ? (current(_draft) as State) : _state;
          if (
            cache &&
            !isChanged(cache.state, state, cache.affected, new WeakMap(), isOriginalEqual)
          ) {
            touchAffected(state, cache.state, cache.affected);
            return cache.cachedResult;
          }
          const affected: Affected = new WeakMap();
          const proxy = createProxy(state, affected, undefined, targetCache);
          activeStateProxies.push(proxy);
          const thisArg = getComputedThis(_computedState, proxy);
          const value = untrack(computed[prop as keyof Computed]!.call(thisArg));
          activeStateProxies.pop();
          touchAffected(state, state, affected);
          computedCache.set(prop, { state, affected, cachedResult: value });
          return value;
        }

        if (_draft) return Reflect.get(_draft, prop, receiver);

        let result: any;
        setState(
          produce(_state, (draft) => {
            _draft = draft;
            try {
              result = undraft(Reflect.get(draft, prop, receiver));
            } finally {
              _draft = null;
            }
          }),
        );
        return result;
      },

      set: (_, prop, value, receiver) => {
        if (_draft) return Reflect.set(_draft, prop, value, receiver);

        let success = false;
        setState(
          produce(_state, (draft) => {
            _draft = draft;
            success = Reflect.set(draft, prop, value, receiver);
            _draft = null;
          }),
        );
        return success;
      },

      deleteProperty: (_, prop) => {
        if (_draft) return Reflect.deleteProperty(_draft, prop);

        let success = false;
        setState(
          produce(_state, (draft) => {
            _draft = draft;
            success = Reflect.deleteProperty(draft, prop);
            _draft = null;
          }),
        );
        return success;
      },
    },
  );

  for (const key in actions) {
    const handler = actions[key]!;
    (store as any)[key] = renameFunction((...args: never) => {
      if (_draft) return handler.apply(thisArg, args);
      let result: any;
      setState(
        produce(_state, (draft) => {
          _draft = draft;
          try {
            result = undraft(handler.apply(thisArg, args));
          } finally {
            _draft = null;
          }
        }),
      );
      return result;
    }, key);
  }

  return Object.freeze(store) as any;
}

/*********
 * Slice *
 *********/
/**
 * A slice of a {@linkcode Store}.
 */
export type Slice<
  State extends object,
  Computed extends ComputedOptions,
  Actions extends Record<string, (...args: never) => unknown>,
> = State & {
  computed?: Computed;
  actions?: Actions;
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
 * import { createSlice, createStore, withSlices } from "troza";
 *
 * const counterSlice = createSlice({
 *   count: 0,
 *   computed: {
 *     doubleCount() {
 *       return this.count * 2;
 *     },
 *   },
 *   actions: {
 *     inc() {
 *       this.count++;
 *     },
 *   },
 * });
 *
 * const nameSlice = createSlice({
 *   name: "John Doe",
 *   actions: {
 *     changeName(name: string) {
 *       this.name = name;
 *     },
 *   },
 * });
 *
 * const store = createStore(withSlices(counterSlice, nameSlice));
 * ```
 *
 * @see {@linkcode withSlices}
 */
export function createSlice<
  State extends object,
  Computed extends ComputedOptions = {},
  Actions extends Record<string, (...args: never) => unknown> = {},
>(
  slice: State & {
    computed?: Computed &
      ThisType<
        ReadonlyStoreBase<Prettify<Omit<State, "computed" | "actions">>, Computed> &
          Prettify<
            Readonly<
              Omit<State, "computed" | "actions"> &
                ExtractComputedReturns<Computed> & {
                  [K in keyof Actions]: Actions[K];
                }
            >
          >
      >;
    actions?: Actions &
      ThisType<
        StoreBase<Prettify<Omit<State, "computed" | "actions">>, Computed> &
          Prettify<
            Omit<State, "computed" | "actions"> &
              ExtractComputedReturns<Computed> & {
                readonly [K in keyof Actions]: Actions[K];
              }
          >
      >;
  },
): Prettify<
  State &
    ([keyof Computed] extends [never] ? {} : { computed: Computed }) &
    ([keyof Actions] extends [never] ? {} : { actions: Actions })
> {
  return slice as any;
}

type MergeSlices<Slices> =
  _MergeSlices<Slices> extends (
    {
      state: infer State;
      computed: infer Computed;
      actions: infer Actions;
    }
  ) ?
    Prettify<
      State &
        ([keyof Computed] extends [never] ? {} : { computed: Computed }) &
        ([keyof Actions] extends [never] ? {} : { actions: Actions })
    >
  : never;
type _MergeSlices<
  Slices,
  Acc extends {
    state: object;
    computed: ComputedOptions;
    actions: Record<string, (...args: never) => unknown>;
  } = { state: {}; computed: {}; actions: {} },
> =
  Slices extends [infer S, ...infer Rest] ?
    _MergeSlices<
      Rest,
      {
        state: Prettify<Acc["state"] & Omit<S, "computed" | "actions">>;
        computed: Prettify<Acc["computed"] & ("computed" extends keyof S ? S["computed"] : {})>;
        actions: Prettify<Acc["actions"] & ("actions" extends keyof S ? S["actions"] : {})>;
      }
    >
  : Acc;

/**
 * Merge multiple slices into a single slice.
 * @param slices The slices to merge.
 * @returns
 *
 * @see {@linkcode createSlice} for how to create and use slices.
 */
export function withSlices<Slices extends Slice<any, any, any>[]>(
  ...slices: Slices
): MergeSlices<Slices> {
  const state = {};
  const computed = {};
  const actions = {};

  for (const slice of slices) {
    Object.assign(state, slice);
    Object.assign(computed, slice.computed);
    Object.assign(actions, slice.actions);
  }

  return { ...state, computed, actions } as any;
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

/* Immer */
const immer = new Immer();
immer.setAutoFreeze(false); // Enable nested proxies for proxy-compare
const { produce } = immer;

/**
 * Undraft a (possibly) immer draft deeply.
 * @param value The value to undraft.
 * @param seen A weak set to keep track of visited objects to avoid circular references.
 * @returns The undrafted value.
 */
export const undraft = <T>(value: T, seen: WeakSet<object> = new WeakSet()): T => {
  if (!isObject(value)) return value;
  if (isDraft(value)) return current(value);
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !descriptor.value) continue;
    const v: any = descriptor.value;
    if (seen.has(v)) continue;
    value[key as keyof T] = undraft(v, seen);
  }
  return value;
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
    const proxy = createProxy(state, affected, undefined, targetCache);
    activeStateProxies.push(proxy);
    const result = untrack(fn(proxy), new WeakSet());
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
 * @param value The value to untrack.
 * @param seen A weak set to keep track of visited objects to avoid circular references.
 * @returns The untracked value.
 */
export const untrack = <T>(x: T, seen: WeakSet<object> = new WeakSet()): T => {
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
  used[HAS_KEY_PROPERTY]?.forEach((key) => {
    Reflect.has(dst, key);
  });
  if (used[ALL_OWN_KEYS_PROPERTY] === true) Reflect.ownKeys(dst);
  used[HAS_OWN_KEY_PROPERTY]?.forEach((key) => {
    Reflect.getOwnPropertyDescriptor(dst, key);
  });
  used[KEYS_PROPERTY]?.forEach((key) => {
    touchAffected(dst[key as keyof typeof dst], src[key as keyof typeof src], affected);
  });
};

const isOriginalEqual = (x: unknown, y: unknown): boolean => {
  for (let xx = x; xx; x = xx, xx = getUntracked(xx));
  for (let yy = y; yy; y = yy, yy = getUntracked(yy));
  return Object.is(x, y);
};
