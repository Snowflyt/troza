import { createProxy, isChanged } from "proxy-compare";
import {
  useDebugValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import type { Store } from ".";
import { memoizeSelector } from ".";

/**
 * Force TypeScript to evaluate {@linkcode T} eagerly.
 *
 * This is just used to make type information more readable on hover.
 */
type PrettifyReadonly<T> = T extends infer U ? { readonly [K in keyof U]: U[K] } : never;

// This is required only for performance.
const targetCache = new WeakMap();

/**
 * A hook to subscribe to a store with auto dependency tracking.
 *
 * If a selector is provided, you explicitly define which parts of the state your component depends
 * on, rather than relying on auto dependency tracking, which is useful for reducing potential
 * performance overhead. However, auto dependency tracking is still enabled inside selectors,
 * allowing you to select multiple states without worrying about unnecessary re-renders.
 *
 * NOTE: Since selectors are memoized, they should depend solely on the store state and not on any
 * external variables (e.g., `props` or states returned by `useState` or `useReducer`).
 *
 * We recommend using {@linkcode hookify} to create a custom hook for your store instead of
 * using this hook directly, as it is more friendly to React developer tools.
 * @param store The {@linkcode Store} to subscribe to.
 * @param selector A function that takes the state and returns the selected value.
 * @returns
 *
 * @example
 * ```typescript
 * function Counter() {
 *   // Only re-renders when `count` changes
 *   const { count } = useStore(counterStore);
 *   const { inc, incBy, reset } = counterStore;
 *   // ...
 * }
 *
 * function AnotherComponent() {
 *   // Use a selector if you prefer less magic
 *   const [foo, bar] = useStore(myStore, (state) => [state.foo, state.bar]);
 *   // ...
 * }
 * ```
 */
export function useStore<
  State extends object,
  Computed extends object,
  Actions extends Record<string, (...args: never) => unknown>,
  const Selected = PrettifyReadonly<State & Computed>,
>(
  store: Store<State, Computed, Actions>,
  selector?: (state: PrettifyReadonly<State & Computed>) => Selected,
): Selected {
  if (selector) {
    selector = useMemo(() => memoizeSelector(selector!), []);
    return useSyncExternalStore(
      (onStoreChange) => store.$subscribe(onStoreChange),
      () => selector!(store.$get() as any),
      () => selector!(store.$getInitialState() as any),
    );
  }

  // Auto track dependencies when no selector is provided. Inspired by Valtio:
  // https://github.com/pmndrs/valtio/blob/75097c8fb2dd8080123808adc2ad11f0a6f7fc82/src/react.ts#L112-L165
  const affected = useMemo(() => new WeakMap<object, unknown>(), [store]);
  const lastState = useRef<ReturnType<typeof store.$get>>(undefined);
  let rendering = true;
  const currState = useSyncExternalStore(
    (onStoreChange) => store.$subscribe(onStoreChange),
    () => {
      const state = store.$get();
      try {
        if (
          !rendering &&
          lastState.current &&
          !isChanged(lastState.current, state, affected, new WeakMap())
        ) {
          // Not changed
          return lastState.current;
        }
      } catch {
        // Ignore if a promise or something is thrown
      }
      return state;
    },
    () => store.$getInitialState(),
  );
  rendering = false;
  useLayoutEffect(() => {
    lastState.current = currState;
  });
  const proxyCache = useMemo(() => new WeakMap(), []); // Per-hook proxyCache
  return createProxy(currState, affected, proxyCache, targetCache) as Selected;
}

/**
 * Watch for changes in the store and call the watcher function whenever the auto-tracked
 * dependencies change.
 *
 * NOTE: Only dependencies referenced in the first call stack are tracked. That is to say,
 * dependencies that are accessed asynchronously will not trigger a re-run of the watcher.
 *
 * NOTE: Like subscribers, watchers are only attempted to be triggered after the next state change
 * rather than immediately upon creation. Therefore, avoid using them to initialize state or trigger
 * side effects that should run as soon as the component mounts.
 * @param store The {@linkcode Store} to watch.
 * @param watcher A function that takes the current state and the previous state.
 *
 * @example
 * ```typescript
 * function TodoList() {
 *   const [todo, setTodo] = useState("");
 *
 *   useWatch(todoStore, async (state) => {
 *     const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${state.id}`);
 *     const todo = await response.json();
 *     setTodo(todo.title);
 *   });
 *
 *   // ...
 * }
 * ```
 */
export function useWatch<
  State extends object,
  Computed extends object,
  Actions extends Record<string, (...args: never) => unknown>,
>(
  store: Store<State, Computed, Actions>,
  watcher: (
    state: PrettifyReadonly<State & Computed>,
    prevState: PrettifyReadonly<State & Computed>,
  ) => void | Promise<void>,
): void {
  useEffect(() => store.$watch(watcher), [store]);
}

/**
 * Create a React hook that can be used to subscribe to a store and get the selected value from the
 * state.
 * @param name A name for the hook, used for debugging purposes.
 * @param store The {@linkcode Store} to subscribe to.
 * @returns The hook that can be used to subscribe to the store.
 *
 * @example
 * ```typescript
 * const useCounterStore = hookify("counter", counterStore);
 *
 * function Counter() {
 *   const { count } = useCounterStore();
 *   const { inc, incBy, reset } = counterStore;
 *   // ...
 * }
 *
 * const useMyStore = hookify("my", myStore);
 *
 * function MyComponent() {
 *   const { foo, bar } = useMyStore();
 *   const [baz, qux] = useMyStore((state) => [state.baz, state.qux]);
 *   // ...
 * }
 * ```
 */
export function hookify<
  State extends object,
  Computed extends object,
  Actions extends Record<string, (...args: never) => unknown>,
>(
  name: string,
  store: Store<State, Computed, Actions>,
): <const Selected = PrettifyReadonly<State & Computed>>(
  selector?: (state: PrettifyReadonly<State & Computed>) => Selected,
) => Selected;
export function hookify<
  State extends object,
  Computed extends object,
  Actions extends Record<string, (...args: never) => unknown>,
>(
  store: Store<State, Computed, Actions>,
): <const Selected = State>(
  selector?: (state: PrettifyReadonly<State & Computed>) => Selected,
) => Selected;
export function hookify<
  State extends object,
  Computed extends object,
  Actions extends Record<string, (...args: never) => unknown>,
>(nameOrStore: string | Store<State, Computed, Actions>, store?: Store<State, Computed, Actions>) {
  const name = typeof nameOrStore === "string" ? nameOrStore : "anonymous";
  store = store || typeof nameOrStore === "string" ? store : nameOrStore;
  if (!store || typeof store !== "object" || !("$get" in store) || !("$set" in store))
    throw new TypeError("The store must be a valid store created by `create`.");

  return Object.defineProperty(
    <Selected = PrettifyReadonly<State & Computed>>(
      selector?: (state: PrettifyReadonly<State & Computed>) => Selected,
    ): Selected => {
      const selectedValue = useStore(store, selector);
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
