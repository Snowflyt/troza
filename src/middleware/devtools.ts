/**
 * Redux DevTools middleware.
 *
 * The implementation is inspired by Zustand’s Redux DevTools middleware implementation.
 * https://github.com/pmndrs/zustand/blob/a90981afb5c935b90719c7c85808796caaf55f24/src/middleware/devtools.ts
 */

import type {} from "@redux-devtools/extension";
import type {
  ExtractSliceActions,
  ExtractSliceComputed,
  ExtractSliceState,
  Store,
  StoreBase,
} from "..";
import { getterNamePrefix } from "..";

/**
 * Force TypeScript to evaluate {@linkcode T} eagerly.
 *
 * This is just used to make type information more readable on hover.
 */
type Prettify<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

// https://github.com/reduxjs/redux-devtools/issues/1097
type Message = {
  type: string;
  payload?: any;
  state?: any;
};

type Instance = ReturnType<
  (Window extends { __REDUX_DEVTOOLS_EXTENSION__?: infer T } ? T : never)["connect"]
>;

type Config = Parameters<
  (Window extends { __REDUX_DEVTOOLS_EXTENSION__?: infer T } ? T
  : { connect: (param: any) => any })["connect"]
>[0];
export interface DevtoolsOptions extends Config {
  /**
   * The group name of the store. Each group represents a Redux DevTools instance.
   *
   * By default, Troza groups all stores into a single global group for each application. That is
   * to say, you can see all stores in a single Redux DevTools instance. If you want to separate
   * stores into different groups, you can specify the group name here.
   */
  group?: string;
  /**
   * The name of the store. Defaults to `anonymous${index}`.
   *
   * No need to specify this if you already use `hookify` to create a named custom hook for your
   * store.
   */
  name?: string;
  /**
   * Whether to enable the DevTools middleware.
   */
  enabled?: boolean;
}

let isInitializing = true;
void Promise.resolve().then(() => (isInitializing = false));

const instances = new Map<string, Instance>();

const groupStoreCount = new Map<string, number>();
const groupStoreApis = new Map<
  string,
  Record<
    string,
    {
      computedNames: Set<string>;
      actions: Record<string, (...args: never) => unknown>;
      prettifyComputed: (computedState: object) => object;
      store: Store<any, any, any>;
      api: StoreBase<any, any, any>;
      set: (newState: any) => void;
      patch: (newState: any) => void;
      setStateFromDevTools: (newState: any) => void;
    }
  >
>();
const groupLastState = new Map<string, object>();
// Only used when a new store is asynchronously added to a single-store group
const collapsedGroupLastState = new Map<string, object>();

let anonymousIndex = 1;

/**
 * DevTools middleware for Troza.
 *
 * This is to connect with [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools).
 * @returns
 *
 * @example
 * ```typescript
 * import { create } from "troza";
 * import { devtools } from "troza/middleware";
 *
 * const store = create(devtools({
 *   count: 0,
 *   incBy(by: number) {
 *     this.count += by;
 *   },
 *
 *   text: "hello",
 *   changeText(text: string) {
 *     this.text = text;
 *   },
 * }));
 * ```
 */
export function devtools<Slice extends object>(
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
  options: DevtoolsOptions = {},
): Slice {
  const { enabled, group = "troza/globalStore", name: _storeName = "", ...restOptions } = options;
  let storeName = _storeName;

  let extension: (typeof window)["__REDUX_DEVTOOLS_EXTENSION__"] | false;
  try {
    extension =
      // @ts-expect-error - Already wrapped in try-catch
      (enabled ?? import.meta.env?.MODE !== "production") && window.__REDUX_DEVTOOLS_EXTENSION__;
  } catch {
    // Ignored
  }
  if (!extension) {
    try {
      // @ts-expect-error - Already wrapped in try-catch
      if (import.meta.env?.MODE !== "production" && enabled)
        console.warn(
          "[Troza DevTools middleware] Please install/enable Redux DevTools extension in your browser.",
        );
    } catch {
      // Ignore
    }
    return slice;
  }

  const isCreatedOnStart = isInitializing;

  groupStoreCount.set(group, (groupStoreCount.get(group) || 0) + 1);

  type State = ExtractSliceState<Slice>;
  type Computed = ExtractSliceComputed<Slice>;
  type Actions = ExtractSliceActions<Slice>;

  type StoreType = Store<State, Computed, Actions>;
  type StoreApi = StoreBase<State, Computed, Actions>;

  let devTools!: ReturnType<typeof extension.connect>;

  let lastIsRecording = true;
  let isRecording = true;
  let lastActionName = "";
  let lastActionArgs: unknown[] = [];

  let store!: StoreType;
  let api!: StoreApi;

  const removeComputed = (computedState: object) => {
    const result: Record<string | symbol, unknown> = {};
    for (const key of Reflect.ownKeys(computedState)) {
      const desc = Reflect.getOwnPropertyDescriptor(computedState, key)!;
      if (!("value" in desc)) continue;
      Object.defineProperty(result, key, desc);
    }
    return result;
  };

  const prettifyComputed = (computedState: object) => {
    const result: Record<string | symbol, unknown> = {};
    for (const key of Reflect.ownKeys(computedState)) {
      const desc = Reflect.getOwnPropertyDescriptor(computedState, key)!;
      if (!("value" in desc)) continue;
      Object.defineProperty(result, key, desc);
    }
    for (const key of computedNames) {
      if (!(key in computedState)) continue;
      result["~getter:" + key] = (computedState as any)[key];
    }
    return result;
  };

  const initializeStoreName = () => {
    const name = (store as any)["troza/internal"].name;
    if (typeof name === "string" && name) storeName = name;
    if (!storeName) storeName = `anonymous${anonymousIndex++}`;
  };

  const reportAction = (actionName: string, payload: object = {}) => {
    if (!isRecording) return;

    if (!groupLastState.has(group)) {
      const state = prettifyComputed(api.$get());
      devTools.send({ type: `${storeName}/${actionName}`, ...payload }, state);
      collapsedGroupLastState.set(group, { [storeName]: state });
      return;
    }

    const groupState = { ...groupLastState.get(group)!, [storeName]: prettifyComputed(api.$get()) };
    groupLastState.set(group, groupState);
    devTools.send({ type: `${storeName}/${actionName}`, ...payload }, groupState);
  };

  const computedNames = new Set<string>();
  const actions: Record<string, (...args: never) => unknown> = {};

  for (const key of Reflect.ownKeys(slice)) {
    if (typeof key !== "string") continue;
    const desc = Reflect.getOwnPropertyDescriptor(slice, key)!;
    if (!("value" in desc) || typeof desc.value !== "function") continue;
    if (key.startsWith(getterNamePrefix)) {
      computedNames.add(key.slice(getterNamePrefix.length));
      continue;
    }
    actions[key] = desc.value as never;
  }

  for (const key in actions) {
    const action = actions[key]!;
    (slice as any)[key] = Object.defineProperty(
      function (this: any, ...args: never) {
        lastIsRecording = isRecording;
        isRecording = false;
        action.apply(this, args);
        lastActionName = key;
        lastActionArgs = args;
      },
      "name",
      { value: key, configurable: true },
    );
  }

  const initializer = (_store: StoreType, _api: StoreApi) => {
    store = _store;
    api = _api;

    /* $act */
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalAct = api.$act;
    const act: StoreApi["$act"] = (action, args = [] as any) => {
      const originalIsRecording = isRecording;
      isRecording = false;
      const result = originalAct(action, args);
      isRecording = originalIsRecording;
      reportAction("$act", { args });
      return result;
    };
    api.$act = act;

    /* $set */
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalSet = api.$set;
    const set: StoreApi["$set"] = (newState) => {
      const originalIsRecording = isRecording;
      isRecording = false;
      originalSet(newState as never);
      isRecording = originalIsRecording;
      reportAction("$set", { state: removeComputed(api.$get()) });
    };
    api.$set = set;

    /* patch */
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalPatch = api.$patch;
    const patch: StoreApi["$patch"] = (newState) => {
      const originalIsRecording = isRecording;
      isRecording = false;
      const oldState = removeComputed(api.$get());
      const patch = typeof newState === "function" ? newState(oldState as never) : newState;
      originalPatch(patch as never);
      isRecording = originalIsRecording;
      reportAction("$patch", { state: patch });
    };
    api.$patch = patch;

    /* $update */
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalUpdate = api.$update;
    const update: StoreApi["$update"] = (fn) => {
      const originalIsRecording = isRecording;
      isRecording = false;
      originalUpdate(fn);
      isRecording = originalIsRecording;
      reportAction("$update");
    };
    api.$update = update;

    const setStateFromDevTools: StoreApi["$set"] = (newState) => {
      const originalIsRecording = isRecording;
      isRecording = false;
      originalSet(newState as never);
      isRecording = originalIsRecording;
    };

    api.$subscribe(() => {
      if (lastActionName) {
        isRecording = lastIsRecording;
        reportAction(lastActionName, { args: lastActionArgs });
        lastActionName = "";
        lastActionArgs = [];
        return;
      }
      reportAction("DIRECT_MUTATION");
    });

    void Promise.resolve().then(() => {
      initializeStoreName();

      devTools =
        instances.get(group) ||
        extension.connect({
          name: group === "troza/globalStore" ? undefined : group,
          ...restOptions,
        });

      if (isCreatedOnStart && groupStoreCount.get(group) === 1) {
        // The group likely has only one store, init with the initial state directly
        const state = prettifyComputed(api.$get());
        collapsedGroupLastState.set(group, { [storeName]: state });
        groupStoreApis.set(group, {
          [storeName]: {
            computedNames,
            actions,
            prettifyComputed,
            store,
            api,
            set,
            patch,
            setStateFromDevTools,
          },
        });
        devTools.init(state);
      } else {
        if (collapsedGroupLastState.has(group)) {
          groupLastState.set(group, collapsedGroupLastState.get(group)!);
          collapsedGroupLastState.delete(group);
        }
        const groupState = {
          ...groupLastState.get(group),
          [storeName]: prettifyComputed(api.$get()),
        };
        groupLastState.set(group, groupState);
        groupStoreApis.set(group, {
          ...groupStoreApis.get(group),
          [storeName]: {
            computedNames,
            actions,
            prettifyComputed,
            store,
            api,
            set,
            patch,
            setStateFromDevTools,
          },
        });
        devTools.init(groupState);
      }

      // Subscribe PAUSE_RECORDING for each store
      (
        devTools as unknown as {
          // https://github.com/reduxjs/redux-devtools/issues/1097
          subscribe: (listener: (message: Message) => void) => (() => void) | undefined;
        }
      ).subscribe((message) => {
        if (message.type === "DISPATCH" && message.payload.type === "PAUSE_RECORDING")
          isRecording = !isRecording;
      });

      // If already subscribed, return
      if (instances.has(group)) return;
      else instances.set(group, devTools);

      // Main subscription
      (
        devTools as unknown as {
          // https://github.com/reduxjs/redux-devtools/issues/1097
          subscribe: (listener: (message: Message) => void) => (() => void) | undefined;
        }
      ).subscribe((message) => {
        if (message.type === "ACTION" && message.payload) {
          let payload: any;
          try {
            payload = JSON.parse(message.payload);
          } catch (err) {
            console.error(
              "[Troza DevTools middleware] Please dispatch a serializable value that `JSON.parse()` support\n",
              err,
            );
            return;
          }

          if (!payload.type || typeof payload.type !== "string") {
            console.error(
              "[Troza DevTools middleware] Please dispatch an action with a `type` property that is a string\n" +
                "Available payloads:\n" +
                `  - Invoke an action on the store: { "type": "${groupLastState.has(group) ? "storeName/" : ""}actionName", "args": [arg1, arg2] }\n` +
                `  - Set the state: { "type": "${groupLastState.has(group) ? "storeName/" : ""}$set", "state": { "key1": "value1", "key2": "value2" } }\n` +
                `  - Patch the state: { "type": "${groupLastState.has(group) ? "storeName/" : ""}$patch", "patch": { "key1": "value1", "key2": "value2" } }`,
            );
            return;
          }

          if (groupLastState.has(group)) {
            if (
              Object.keys(groupStoreApis.get(group)!).every(
                (storeName) => !payload.type.startsWith(storeName + "/"),
              )
            ) {
              console.error(
                `[Troza DevTools middleware] A valid store name should be prefixed to the action type "${payload.type}", e.g., "${storeName}/${payload.type}"\n` +
                  "All available store names:\n" +
                  Object.keys(groupStoreApis.get(group)!)
                    .map((storeName) => `  - ${storeName}`)
                    .join("\n"),
              );
              return;
            }
          } else {
            if (!payload.type.startsWith(storeName + "/"))
              payload.type = storeName + "/" + payload.type;
          }

          const [dispatchedStoreName, actionName] = payload.type.split("/", 2) as [string, string];

          if (actionName === "$set") {
            if (!payload.state) {
              console.error(
                "[Troza DevTools middleware] $set action should have a `state` property",
              );
              return;
            }
            if (
              payload.state === null ||
              typeof payload.state !== "object" ||
              Array.isArray(payload.state)
            ) {
              console.error(
                "[Troza DevTools middleware] $set action should have a `state` property that is an object",
              );
              return;
            }
            groupStoreApis.get(group)![dispatchedStoreName]!.set(payload.state);
            return;
          }

          if (actionName === "$patch") {
            if (!payload.state) {
              console.error(
                "[Troza DevTools middleware] $patch action should have a `state` property",
              );
              return;
            }
            if (
              payload.state === null ||
              typeof payload.state !== "object" ||
              Array.isArray(payload.state)
            ) {
              console.error(
                "[Troza DevTools middleware] $patch action should have a `state` property that is an object",
              );
              return;
            }
            groupStoreApis.get(group)![dispatchedStoreName]!.patch(payload.state);
            return;
          }

          if (
            Object.keys(groupStoreApis.get(group)![dispatchedStoreName]!.actions).indexOf(
              actionName,
            ) === -1
          ) {
            console.error(
              `[Troza DevTools middleware] The dispatched action "${payload.type}" is not defined in the store\n` +
                "Available actions:\n" +
                Object.keys(groupStoreApis.get(group)![dispatchedStoreName]!.actions)
                  .map((actionName) => `  - ${actionName}`)
                  .join("\n"),
            );
            return;
          }

          if (payload.args && !Array.isArray(payload.args)) {
            console.error(
              "[Troza DevTools middleware] The dispatched action should have an `args` property that is an array",
            );
            return;
          }

          groupStoreApis
            .get(group)!
            [dispatchedStoreName]!.store[actionName](...(payload.args || []));
          return;
        }

        if (message.type === "DISPATCH")
          switch (message.payload.type) {
            case "RESET": {
              if (!groupLastState.has(group)) {
                const state = api.$getInitialState();
                setStateFromDevTools(removeComputed(state) as never);
                collapsedGroupLastState.set(group, { [storeName]: prettifyComputed(state) });
                devTools.init(prettifyComputed(state));
                return;
              }

              const groupState: Record<string, object> = {};
              for (const storeName in groupStoreApis.get(group)!) {
                const { api, prettifyComputed, setStateFromDevTools } =
                  groupStoreApis.get(group)![storeName]!;
                const state = api.$getInitialState();
                setStateFromDevTools(removeComputed(state));
                groupState[storeName] = prettifyComputed(state);
              }
              groupLastState.set(group, groupState);
              devTools.init(groupState);
              return;
            }

            case "COMMIT": {
              devTools.init(groupLastState.get(group) || prettifyComputed(api.$get()));
              return;
            }

            case "ROLLBACK":
              parseJsonThen<object>(message.state, (state) => {
                if (!groupLastState.has(group)) {
                  const newState = { ...state };
                  computedNames.forEach((name) => {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete (newState as any)[name];
                  });
                  setStateFromDevTools(newState as never);
                  collapsedGroupLastState.set(group, { [storeName]: prettifyComputed(api.$get()) });
                  devTools.init(prettifyComputed(api.$get()));
                  return;
                }

                const groupState: Record<string, object> = {};
                for (const storeName in groupStoreApis.get(group)!) {
                  const { api, computedNames, prettifyComputed, setStateFromDevTools } =
                    groupStoreApis.get(group)![storeName]!;
                  const newState = { ...(state as any)[storeName] };
                  computedNames.forEach((name) => {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete newState[name];
                  });
                  setStateFromDevTools(newState);
                  groupState[storeName] = prettifyComputed(api.$get());
                }
                groupLastState.set(group, groupState);
                devTools.init(groupState);
              });
              return;

            case "JUMP_TO_STATE":
            case "JUMP_TO_ACTION":
              parseJsonThen<object>(message.state, (state) => {
                if (!groupLastState.has(group)) {
                  const newState = { ...state };
                  computedNames.forEach((name) => {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete (newState as any)[name];
                  });
                  setStateFromDevTools(newState as never);
                  collapsedGroupLastState.set(group, { [storeName]: prettifyComputed(api.$get()) });
                  return;
                }

                const groupState: Record<string, object> = {};
                for (const storeName in groupStoreApis.get(group)!) {
                  const { api, computedNames, prettifyComputed, setStateFromDevTools } =
                    groupStoreApis.get(group)![storeName]!;
                  const newState = { ...(state as any)[storeName] };
                  computedNames.forEach((name) => {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete newState[name];
                  });
                  setStateFromDevTools(newState);
                  groupState[storeName] = prettifyComputed(api.$get());
                }
                groupLastState.set(group, groupState);
              });
              return;

            case "IMPORT_STATE": {
              const { nextLiftedState } = message.payload;
              const lastComputedState = nextLiftedState.computedStates.slice(-1)[0]?.state;
              if (!lastComputedState) return;
              if (!groupLastState.has(group)) {
                const state = { ...lastComputedState };
                computedNames.forEach((name) => {
                  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                  delete state[name];
                });
                setStateFromDevTools(state);
                collapsedGroupLastState.set(group, { [storeName]: prettifyComputed(api.$get()) });
              } else {
                const groupState: Record<string, object> = {};
                for (const storeName in groupStoreApis.get(group)!) {
                  const { api, computedNames, prettifyComputed, setStateFromDevTools } =
                    groupStoreApis.get(group)![storeName]!;
                  const state = { ...lastComputedState[storeName] };
                  computedNames.forEach((name) => {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete state[name];
                  });
                  setStateFromDevTools(state);
                  groupState[storeName] = prettifyComputed(api.$get());
                }
                groupLastState.set(group, groupState);
              }
              devTools.send(null as any, nextLiftedState);
              return;
            }
          }
      });
    });
  };

  const originalInitializer = (slice as any)["troza/initializer"];
  if (typeof originalInitializer === "function")
    (slice as any)["troza/initializer"] = (store: any, api: any) => {
      originalInitializer(store, api);
      initializer(store, api);
    };
  else (slice as any)["troza/initializer"] = initializer;

  return slice;
}

const parseJsonThen = <T>(stringified: string, fn: (parsed: T) => void) => {
  let parsed: T | undefined;
  try {
    parsed = JSON.parse(stringified);
  } catch (e) {
    console.error("[Troza DevTools middleware] Could not parse the received json", e);
  }
  if (parsed !== undefined) fn(parsed as T);
};
