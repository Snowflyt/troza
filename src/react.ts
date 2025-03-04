import { useDebugValue, useEffect, useMemo, useSyncExternalStore } from "react";

import type { ComputedOptions, ExtractComputedReturns, Store } from ".";
import { memoizeSelector } from ".";

/**
 * Force TypeScript to evaluate {@linkcode T} eagerly.
 *
 * This is just used to make type information more readable on hover.
 */
type Prettify<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

/**
 * A hook to subscribe to a store and get the selected value from the state.
 *
 * Dependencies are automatically tracked in the selector function, so feel free to use selectors
 * like `(state) => ({ foo: state.foo, bar: state.bar })`.
 *
 * We recommend using {@linkcode hookify} to create a custom hook for your store instead of
 * using this hook directly, as it is more friendly to React developer tools.
 * @param store The store to subscribe to.
 * @param selector A function that takes the state and returns the selected value.
 * @returns The selected value from the state.
 *
 * @example
 * ```typescript
 * function Counter() {
 *   const count = useStore(counterStore, (state) => state.count);
 *   const { inc, incBy, reset } = counterStore;
 *   // ...
 * }
 *
 * function AnotherComponent() {
 *   const [foo, bar] = useStore(myStore, (state) => [state.foo, state.bar]);
 *   const { baz, qux } = useStore(myStore, (state) => ({ baz: state.baz, qux: state.qux }));
 *   // ...
 * }
 * ```
 */
export function useStore<
  State extends object,
  Computed extends ComputedOptions,
  Actions extends Record<string, (...args: never) => unknown>,
  const Selected = State,
>(
  store: Store<State, Computed, Actions>,
  selector?: (state: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>) => Selected,
): Selected {
  selector = useMemo(
    () => (selector ? memoizeSelector(selector) : (state) => state as unknown as Selected),
    [],
  );
  return useSyncExternalStore(
    (onStoreChange) => store.$subscribe(onStoreChange),
    () => selector(store.$get() as any),
    () => selector(store.$getInitialState() as any),
  );
}

export function useWatch<
  State extends object,
  Computed extends ComputedOptions,
  Actions extends Record<string, (...args: never) => unknown>,
>(
  store: Store<State, Computed, Actions>,
  watcher: (
    state: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>,
    prevState: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>,
  ) => void | Promise<void>,
): void {
  useEffect(() => store.$watch(watcher), [store]);
}

/**
 * Create a React hook that can be used to subscribe to a store and get the selected value from the
 * state.
 * @param name A name for the hook, used for debugging purposes.
 * @param store The store to subscribe to.
 * @returns The hook that can be used to subscribe to the store.
 *
 * @example
 * ```typescript
 * const useCounterStore = hookify("counter", counterStore);
 *
 * function Counter() {
 *   const count = useCounterStore((state) => state.count);
 *   const { inc, incBy, reset } = counterStore;
 *   // ...
 * }
 *
 * const useMyStore = hookify("my", myStore);
 *
 * function MyComponent() {
 *   const [foo, bar] = useMyStore((state) => [state.foo, state.bar]);
 *   const { baz, qux } = useMyStore((state) => ({ baz: state.baz, qux: state.qux }));
 *   // ...
 * }
 * ```
 */
export function hookify<
  State extends object,
  Computed extends ComputedOptions,
  Actions extends Record<string, (...args: never) => unknown>,
>(
  name: string,
  store: Store<State, Computed, Actions>,
): <const Selected = State>(
  selector?: (state: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>) => Selected,
) => Selected;
export function hookify<
  State extends object,
  Computed extends ComputedOptions,
  Actions extends Record<string, (...args: never) => unknown>,
>(
  store: Store<State, Computed, Actions>,
): <const Selected = State>(
  selector?: (state: Prettify<Readonly<State & ExtractComputedReturns<Computed>>>) => Selected,
) => Selected;
export function hookify<
  State extends object,
  Computed extends ComputedOptions,
  Actions extends Record<string, (...args: never) => unknown>,
>(nameOrStore: string | Store<State, Computed, Actions>, store?: Store<State, Computed, Actions>) {
  const name = typeof nameOrStore === "string" ? nameOrStore : "anonymous";
  store = store || typeof nameOrStore === "string" ? store : nameOrStore;
  if (!store || typeof store !== "object" || !("$get" in store) || !("$set" in store))
    throw new TypeError("The store must be a valid store created by `createStore`.");

  return Object.defineProperty(
    <Selected = State>(
      selector?: (state: Readonly<State & ExtractComputedReturns<Computed>>) => Selected,
    ): Selected => {
      selector = useMemo(
        () => (selector ? memoizeSelector(selector) : (state) => state as unknown as Selected),
        [],
      );
      const selectedValue = useSyncExternalStore(
        (onStoreChange) => store.$subscribe(onStoreChange),
        () => selector(store.$get()),
        () => selector(store.$getInitialState()),
      );
      useDebugValue(selectedValue);
      return selectedValue;
    },
    "name",
    {
      value: `use${(name[0] || "").toUpperCase()}${name.slice(1)}Store`,
      configurable: true,
    },
  );
}
