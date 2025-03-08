<h1 align="center">Troza</h1>

`npm install troza` makes _intuitive_ state management easier than ever.

[![downloads](https://img.shields.io/npm/dm/troza.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/troza)
[![version](https://img.shields.io/npm/v/troza.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/troza)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/troza.svg?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/package/troza)
[![coverage status](https://img.shields.io/coverallsCoverage/github/Snowflyt/troza?branch=main&style=flat&colorA=000000&colorB=000000)](https://coveralls.io/github/Snowflyt/troza?branch=main)
[![license](https://img.shields.io/npm/l/troza.svg?style=flat&colorA=000000&colorB=000000)](https://github.com/Snowflyt/troza)

Troza is a lightweight, TypeScript-friendly state management library with easy composability.

- A single **immutable** state tree with mutable-style updates.
- **Auto dependency tracking** for **computed states** and your components.
- Direct action access on your store—no extra hooks required.

You can try a live demo [here](https://githubbox.com/Snowflyt/troza/tree/main/examples/demo-react).

### First create a store

```typescript
import { create } from "troza";

const counterStore = create({
  count: 0,
  incBy(by: number) {
    this.count += by;
  },
});

export default counterStore;
```

### Then use it in your components, and that’s it!

```tsx
import { useStore } from "troza/react";
import counterStore from "../stores/counter";

// Actions are directly accessible via `store.action()`
const { incBy } = counterStore;

function Counter() {
  // Only re-render when `count` changes
  const { count } = useStore(counterStore);
  return <div>Count: {count}</div>;
}

function CounterControls() {
  return <button onClick={() => incBy(1)}>One up</button>;
}
```

Also, check out the [`hookify`](#create-hooks-for-stores-to-avoid-boilerplate) utility to create custom hooks for your stores—this enhances compatibility with React DevTools and reduces boilerplate code.

## Recipes

### Create computed states

Troza supports automatically cached computed states. You can define these computed states using the `get` helper function:

```typescript
import { create, get } from "troza";

const counterStore = create({
  count: 0,
  [get("doubled")]() {
    return this.count * 2;
  },
  [get("quadrupled")]() {
    // Computed states can be accessed within other computed states
    return this.doubled * 2;
  },
  increment() {
    // ...or within actions
    if (this.quadrupled > 10) {
      throw new Error("Counter too high");
    }
    this.count++;
  },
});
```

The syntax is similar to standard JavaScript getters, but by using the `get` helper, Troza ensures a better TypeScript experience.

Computed states are **cached** and only re-evaluated when their dependencies change. You can access computed states just like regular state values in your components, without worrying about unnecessary re-renders:

```tsx
const store = create({
  count: 0,
  nums: [1, 2, 3],
  [get("oddNums")]() {
    // Only re-run when `nums` changes
    return this.nums.filter((num) => num % 2 === 0);
  },
});

function MyComponent() {
  // Does not re-render when unrelated state (e.g., `count`) changes
  const { oddNums } = useStore(store);
  // ...
}
```

<details>
  <summary><strong>Caveat:</strong> Computed states are not allowed to mutate the state</summary>

Computed states cannot mutate the state because the state passed to the computed state is read-only. For example, the following code will not work:

```typescript
const todoStore = create({
  loading: false,
  todoId: 1,
  async [get("todo")]() {
    // This will throw an error
    this.loading = true;
    // The rest of the function will never run
    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${this.todoId}`);
    const todo = await response.json();
    this.loading = false;
    return todo;
  },
});

function TodoList() {
  const todo = use(useStore(todoStore).todo);
  // ...
}
```

And you’ll see an error like:

```text
Uncaught (in promise) TypeError: setting getter-only property "loading"
```

If you need to update the state in a computed state, consider using an action instead—actions can read and write to the state and can also return a value like a computed state.

</details>

### Create hooks for stores to avoid boilerplate

`useStore` is a straightforward way to use the store, but you can also create custom hooks using `hookify` to make your code more friendly to React DevTools and reduce boilerplate.

```typescript
import { create } from "troza";
import { hookify } from "troza/react";

const counterStore = create({
  /* ... */
});

export default counterStore;

export const useCounterStore = hookify("count", bookStore);
```

The first argument of `hookify` is the store’s name, which helps during debugging. You can omit this argument if it’s not needed.

Then, you can use `useCounterStore` in your components:

```typescript
import { useCounterStore } from "../stores/counter";

function Counter() {
  const { count } = useCounterStore();
  // ...
}
```

### Using selectors

If you prefer [Zustand](https://github.com/pmndrs/zustand)-like selectors over relying solely on auto dependency tracking, that’s totally fine. You can pass an optional selector function to `useStore` (or your custom hook) to explicitly pick the state your component depends on:

```typescript
function BookList() {
  // Select a single state
  const readingBook = useStore(bookStore, (state) => state.reading);

  // Select multiple states
  const [readingBook, readBooks] = useStore(bookStore, (state) => [
    state.readingBook,
    state.readBooks,
  ]);

  // Derive state directly in the selector, eliminating the need for `useMemo`
  const tomes = useBookStore((state) =>
    // Re-run only when `bookshelf.books` changes
    state.bookshelf.books.filter((book) => book.pages >= 300),
  );

  // ...
}
```

By using selectors, you explicitly define which parts of the state your component relies on instead of depending solely on auto dependency tracking. However, auto dependency tracking is still active inside selectors, so you can safely select multiple states without causing unnecessary re-renders.

Keep in mind that since selectors are memoized, they should depend solely on the store state—not on external variables (e.g., `props` or states returned by `useState` or `useReducer`). If you need to use external variables, consider defining an unmemoized version of `useStore` yourself.

<details>
  <summary>Click to see the unmemoized version of <code>useStore</code></summary>

```typescript
import type { Store } from "troza";

export function useUnmemoizedStore<
  State extends object,
  Computed extends object,
  Actions extends Record<string, (...args: never) => unknown>,
  const Selected = State,
>(
  store: Store<State, Computed, Actions>,
  selector?: (state: Readonly<State & Computed>) => Selected,
): Selected {
  selector = selector || ((state) => state as unknown as Selected);
  return useSyncExternalStore(
    (onStoreChange) => store.$subscribe(onStoreChange),
    () => selector(store.$get() as any),
    () => selector(store.$getInitialState() as any),
  );
}
```

</details>

### Directly accessing state and computed states

Besides calling actions on your store, you can also directly read state and computed states from the store object. For example:

```typescript
const store = create({
  count: 0,
  [get("doubled")]() {
    return this.count * 2;
  },
});

console.log(store.count); // 0
store.count++;
console.log(store.count); // 1
console.log(store.doubled); // 2
```

While this direct access is possible, you still have to use `useStore` or `useCounterStore` to subscribe to state changes for proper re-rendering. For example, the following `Counter` component won’t re-render when `store.count` changes:

```tsx
const counterStore = create({ count: 0 });

function Counter() {
  return <div>{store.count}</div>;
}

function CounterControls() {
  return <button onClick={() => store.count++}>One up</button>;
}
```

**Caveat:** Direct access is provided to simplify updating a single state value without a dedicated action. However, Troza cannot batch updates when multiple state changes are made via direct access, which can hurt performance and lead to unexpected behavior. It’s best to use actions for multiple state updates.

<details>
  <summary>Click to see an example of anti-intuitive behavior caused by direct access</summary>

Consider the following example:

```typescript
const store = create({ nums: [1, 2, 3] });

const f = () => {
  const nums = store.nums;
  nums.push(4);
  nums.push(5);
};

function MyComponent() {
  const { nums } = useStore(store);
  console.log(nums);
  // ...
}
```

You might expect `[1, 2, 3, 4, 5]` when `f` is called, but the actual result is `[1, 2, 3, 4]`:

- `const nums = state.nums` retrieves a proxy of the `store.nums` array.
- `nums.push(4)` mutates the proxy and **eagerly flushes** the changes to the actual state.
- Each flush creates a new state instead of mutating the original one in Troza; here, `store.nums` becomes `[1, 2, 3, 4]`.
- However, `nums` still holds the old proxy, so `nums.push(5)` mutates that disconnected proxy.

In simple cases, you can avoid this by not caching the array in a variable and directly calling `store.nums.push(4)` and `store.nums.push(5)`. In more complex scenarios, this anti-intuitive behavior can be challenging to debug.

To batch updates manually, you can use `store.$set`, `store.$patch` or `store.$update` (see the [async actions section](#async-actions)). However, the best practice is to avoid directly mutating state when you need to make multiple changes—instead, use actions, as they batch updates until the action is complete, preventing this anti-intuitive behavior:

```typescript
const store = create({
  nums: [1, 2, 3],
  // Everything works as expected
  f() {
    const nums = this.nums;
    nums.push(4);
    nums.push(5);
  },
});
```

</details>

### Anonymous actions

Troza provides a way to directly invoke a function as an action without defining it as a named action. This is useful for one-off actions:

```typescript
const store = create({ name: "John Doe", count: 0 });

store.$act(function () {
  this.name = "Jane Doe";
  this.count++;
});
```

It is also possible to define actions in a more functional style without the need to unifying actions inside the store object, by making use of `$act`, but it is not very recommended and violates Troza’s design principles.

<details>
  <summary>Click to see an example of defining actions in a functional style</summary>
  
You can create a helper function like this:

```typescript
const createAction =
  <
    State extends object,
    Computed extends object,
    Actions extends Record<string, (...args: never) => unknown>,
    Args extends unknown[],
    R,
  >(
    store: Store<State, Computed, Actions>,
    fn: (
      state: ThisParameterType<Parameters<Store<State, Computed, Actions>["$act"]>[0]>,
      ...args: Args
    ) => R,
  ) =>
  (...args: Args): R =>
    store.$act(function () {
      return fn(this as any, ...args);
    });
```

And then define actions like this:

```typescript
const incBy = createAction(counterStore, (state, by: number) => {
  state.count += by;
});
```

Or if you prefer a cleaner syntax, try this version:

```typescript
const createDef =
  <
    State extends object,
    Computed extends object,
    Actions extends Record<string, (...args: never) => unknown>,
  >(
    store: Store<State, Computed, Actions>,
  ) =>
  <Args extends unknown[], R>(
    fn: (
      state: ThisParameterType<Parameters<Store<State, Computed, Actions>["$act"]>[0]>,
      ...args: Args
    ) => R,
  ) =>
  (...args: Args): R =>
    store.$act(function () {
      return fn(this as any, ...args);
    });
```

And define actions like this:

```typescript
const def = createDef(counterStore);

const incBy = def((state, by: number) => {
  state.count += by;
});
```

While this approach is possible, it is not recommended because it violates Troza’s design principles. Troza is designed to be used with actions defined directly on the store object, which makes it easier to understand and maintain the code.

Also, such syntax does not handle well with generic TypeScript functions, as it requires manual type annotations for `state` when you define an action with generic type parameters:

```typescript
const f = def(<T,>(state, value: T) => {
  //               ~~~~~
  // Parameter 'state' implicitly has an 'any' type.ts(7006)
});
```

</details>

### Async actions

You can define async actions in Troza without any extra effort:

```typescript
const todoStore = create({
  loading: true,
  todoId: 1,
  todo: null as { id: number; title: string; completed: boolean } | null,
  async fetchTodo() {
    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${this.todoId}`);
    const todo = await response.json();
    this.loading = false;
    this.todo = todo;
  },
});
```

However, async actions prevent Troza from batching updates, which usually won’t cause extra re-renders but will trigger `$subscribe` on every update (see [the later section](#using-in-vanilla-javascript)). If you prefer to batch updates manually, you can use `this.$set`, `this.$patch` or `this.$update` (which are also accessible via `store.$set`, `store.$patch` and `store.$update`).

<details>
  <summary>Click to see an example of using <code>this.$set</code>, <code>this.$patch</code> and <code>this.$update</code></summary>

```typescript
const todoStore = create({
  loading: true,
  todoId: 1,
  todo: null as { id: number; title: string; completed: boolean } | null,
  async fetchTodos() {
    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${this.todoId}`);
    const todo = await response.json();
    // `$update` enables mutable-style updates
    this.$update((state) => {
      state.loading = false;
      state.todo = todo;
    });
    // Or
    this.$set({ loading: false, todoId: this.todoId, todo });
    // Or
    this.$set((prev) => ({
      ...prev,
      loading: false,
      todo: todo.slice(0, 10),
    }));
    // `$patch` is similar to `$set` but updates with partial state
    this.$patch({ loading: false, todo });
    this.$patch((prev) => ({ loading: !prev.loading, todo });
  },
});
```

Note that you don’t need to use `this.$set`, `this.$patch` or `this.$update` if you are using a synchronous action, as Troza will automatically batch updates for you.

</details>

### Async computed states

While the example in the [async actions section](#async-actions) is a possible way for fetching data, you can define an async computed state for a simpler and cleaner approach:

```typescript
const todoStore = create({
  todoId: 1,
  async [get("todo")]() {
    // Only re-run when `todoId` changes
    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${this.todoId}`);
    return await response.json();
  },
});
```

And use it with React suspense and the new `use` hook introduced in React 19:

```tsx
import { Suspense, use } from "react";
import { useTodoStore } from "../stores/todo";

function Todo() {
  const todo = use(useTodoStore((state) => state.todo));
  return <div>{todo.title}</div>;
}

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Todo />
    </Suspense>
  );
}
```

### Slices pattern

Troza creates stores as plain objects, making them easy to compose. You can create slices for different parts of your store and then combine them using object spread:

```typescript
const counterSlice = {
  count: 0,
  increment() {
    this.count++;
  },
};

const nameSlice = {
  name: "John Doe",
  changeName(name: string) {
    this.name = name;
  },
};

const store = create({ ...counterSlice, ...nameSlice });
```

This is ideal when you want to share common logic across multiple stores or break a large store into smaller, manageable parts.

For instance, if many of your stores require similar loading logic with an `isLoading` state and a `showLoading` flag to prevent UI flickering, you can create a reusable slice for that logic:

```typescript
const loadingSlice = {
  isLoading: false,
  showLoading: false,
  startLoading() {
    this.isLoading = true;
    // Set `showLoading` after a delay to avoid UI flickering
    setTimeout(() => {
      if (!this.isLoading) return;
      this.showLoading = this.isLoading;
    }, 300);
  },
  stopLoading() {
    this.isLoading = false;
    this.showLoading = false;
  },
};

const myStore = create({
  ...loadingSlice,
  async loadSomething() {
    this.startLoading();
    // Load something...
    this.stopLoading();
    return loadedData;
  },
});
```

For better TypeScript type inference of computed states, you can use the `slice` helper function to create slices. It simply returns the `slice` object as is but helps with type inference:

```typescript
import { get, slice } from "troza";

const counterSlice = slice({
  count: 0,
  [get("doubled")]() {
    return this.count * 2;
  },
  increment() {
    if (this.doubled > 10) {
      //     ^ TypeScript will infer `this.doubled` as a number
      throw new Error("Counter too high");
    }
    this.count++;
  },
});
```

It is recommended to use the `slice` helper even in JavaScript-only projects, as it provides better editor completion.

### Using in vanilla JavaScript

Troza is a universal library, not tied to any specific framework, so you can use it in vanilla JavaScript as well. The React bindings are just simple wrappers around the core library.

Suppose you have a store like this:

```typescript
const store = create({
  count: 0,
  [get("doubled")]() {
    return this.count * 2;
  },
  incBy(by: number) {
    this.count += by;
  },

  bookshelf: {
    books: [
      { title: "Refactoring", pages: 448, read: true },
      { title: "Clean Code", pages: 464, read: false },
    ],
  },
  [get("readBooks")]() {
    return this.bookshelf.books.filter((book) => book.read);
  },
  markRead(title: string) {
    this.bookshelf.books.find((book) => book.title === title)?.read = true;
  },
  addBook(title: string, pages: number) {
    const book = { title, pages, read: false };
    this.bookshelf.books.push(book);
    return book;
  },
});
```

You can use the following methods to interact with the store:

- `$act`: Invoke a function as an action directly on the store.
- `$get`: Retrieve the current state.
- `$getInitialState`: Retrieve the initial state.
- `$set`: Set the state directly.
- `$patch`: Set the state with partial updates.
- `$update`: Update the state with mutable-style updates (batched).
- `$subscribe`: Subscribe to state changes.
- Actions: Call actions directly on the store.

For example:

```typescript
const state1 = store.$get();
// { count: 0, bookshelf: [...], doubled: [Getter], readBooks: [Getter] }

// Call an action directly
store.incBy(2);

const state2 = store.$get();
// { count: 2, bookshelf: [...], doubled: [Getter], readBooks: [Getter] }

// Each action creates a new state
console.log(state1 === state2); // false
console.log(state1); // { count: 0, bookshelf: [...], doubled: [Getter], readBooks: [Getter] }

// Computed states are cached and only recalculated when their dependencies change
console.log(state1.doubled === state2.doubled); // false
console.log(state1.readBooks === state2.readBooks); // true

// Subscribe to changes
const unsubscribe = store.$subscribe((state, prevState) => {
  console.log("State changed\nm:", prevState, "\n", state);
});

store.inc();
// State changed
// from: { count: 2, bookshelf: [...], doubled: [Getter], readBooks: [Getter] }
// to: { count: 3, bookshelf: [...], doubled: [Getter], readBooks: [Getter] }
store.addBook("JavaScript: The Definitive Guide", 706);
// State changed
// from: { count: 3, bookshelf: [...], doubled: [Getter], readBooks: [Getter] }
// to: { count: 3, bookshelf: [...], doubled: [Getter], readBooks: [Getter] }
store.markRead("JavaScript: The Definitive Guide");
// State changed
// from: { count: 3, bookshelf: [...], doubled: [Getter], readBooks: [Getter] }
// to: { count: 3, bookshelf: [...], doubled: [Getter], readBooks: [Getter] }
```

### Using `$subscribe` with selector

The `$subscribe` method can also accept a selector function to listen only to changes in a specific part of the state:

```typescript
$subscribe(subscriber): () => void;
$subscribe(selector, subscriber): () => void;
```

The selector passed to `$subscribe` is memoized based on its auto-tracked dependencies, meaning it only re-runs when the selected state changes.

```typescript
store.$subscribe(
  (state) => state.count,
  (count, prevCount) => {
    console.log("Count changed:", count, prevCount);
  },
);
```

This behavior is similar to [`watch`](https://vuejs.org/guide/essentials/watchers.html#watch-source-types) in Vue 3—except that Troza always operates on immutable objects rather than reactive ones.

Remember that the same rules for selectors in `useStore` apply here, so avoid using external variables within the selector.

### Watch for changes in a specific part of the state

You might notice an interesting pattern in `$subscribe`—you can pass an empty subscriber function and rely solely on the selector to trigger side effects:

```typescript
store.$subscribe((state) => {
  document.querySelector("#count").innerText = state.count;
}, () => {});
```

Due to the memoized nature of the selector, it only re-runs when the selected part of the state changes, thereby avoiding unnecessary re-renders. This is similar to `useEffect` in React, but without needing a dependency array—or more precisely, [`watchEffect`](https://vuejs.org/guide/essentials/watchers.html#watcheffect) in Vue 3.

For improved code readability and to access the previous state, Troza provides a `$watch` method:

```typescript
const unwatch = store.$watch((state, prevState) => {
  document.querySelector("#count").innerText = state.count;
});
```

For React users, the React bindings offer a `useWatch` hook that automatically unsubscribes when the component unmounts:

```typescript
import { useWatch } from "troza/react";
import userStore from "../stores/user";

function UserProfile() {
  const [userProfile, setUserProfile] = React.useState(null);

  useWatch(userStore, async (state, prevState) => {
    const profile = await fetchUserProfile(state.userId);
    setUserProfile(profile);
  });

  // ...
}
```

You might have noticed that `useWatch` is exactly an alias of `useStore` that allows you to access the previous state, but it is more readable and explicitly intended for watching changes.

Note that, like subscribers, watchers are only attempted to be triggered after the next state change rather than immediately upon creation. Therefore, avoid using them to initialize state or trigger side effects that should run as soon as the component mounts.

### Use Troza more than a store

Troza is primarily designed for managing state across your entire application (i.e., a store), but it’s flexible enough to be used in other ways.

For example, you can define a `useTroza` hook as a `useState` replacement, and use it like this:

```tsx
function Counter() {
  const state = useTroza({ count: 0 });

  return (
    <div>
      <span>Count: {state.count}</span>
      <button onClick={() => state.count++}>One up</button>
    </div>
  );
}
```

<details>
  <summary>Click to see the implementation of <code>useTroza</code></summary>

```typescript
export function useTroza<Slice extends object>(
  sliceFactory: () => Parameters<typeof create<Slice>>[0],
): ReturnType<typeof create<Slice>>;
export function useTroza<Slice extends object>(
  slice: Parameters<typeof create<Slice>>[0],
): ReturnType<typeof create<Slice>>;
export function useTroza(slice: object) {
  const store = React.useMemo(() => create(typeof slice === "function" ? slice() : slice), []);
  React.useSyncExternalStore(
    (onStoreChange) => store.$subscribe(onStoreChange),
    () => store.$get(),
    () => store.$getInitialState(),
  );
  return store;
}
```

</details>

While this approach might seem attractive, remember that Troza is not specifically designed for such use cases. The demonstrated `useTroza` hook is just for illustration and isn’t included in the official library.

If this pattern really appeals to you, consider using [Valtio](https://github.com/pmndrs/valtio), which provides a similar API as the illustration above.

## FAQ

### How should I organize my store?

Troza is not opinionated about how to structure your stor. You can use the slice pattern to create one global store or create multiple stores for different parts of your application.

Below is an example of organizing multiple stores in your project:

```text
├── src
│   ├── components
│   │   ├── Counter.tsx
│   │   └── BookList.tsx
│   ├── stores
│   │   ├── counter.ts
│   │   └── book.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── package-lock.json
└── tsconfig.json
```

In each file in the `stores` folder, you can create a store like this:

```typescript
import { create } from "troza";
import { hookify } from "troza/react";

const counterStore = create({
  /* ... */
});

export default counterStore;

export const useCounterStore = hookify("counter", counterStore);
```

### Why `this` everywhere?

Though `this` in JavaScript sometimes gets a bad rep, not in Troza. Under the hood, Troza statically binds `this` to the store rather than dynamically binding it to the function context. This design lets you destructure actions directly from the store without manually binding `this`.

Using `this` makes the syntax cleaner and more TypeScript-friendly. Without it, you’d have to write something like `actionName: (state) => (...args) => {}` for every action or use less TypeScript-friendly patterns that require manual type annotations.

### What’s the magic behind auto dependency tracking and mutable-style updates?

Under the hood, Troza uses two distinct proxy systems for different purposes:

- **Auto Dependency Tracking:** Troza leverages [proxy-compare](https://github.com/dai-shi/proxy-compare) in computed states (and selectors) to track dependencies and re-run them only when those dependencies change.
- **Mutable-Style Updates:** For applying mutable-style updates on an immutable state tree, Troza employs a custom proxy system (implemented in `src/index.ts`). Previously, Immer was used, but it was replaced for better integration and reduced bundle size.

The proxy system is largely inspired by [Valtio](https://github.com/pmndrs/valtio), another proxy-based state management library, but with some key differences:

- Troza maintains an immutable state tree internally and applies updates in a mutable style. Each “mutation” is recorded in a temporary draft and then used to create a new state when the action completes, rather than directly mutating the state and notifying subscribers as Valtio does.
- Troza lazily proxies the state to avoid unnecessary overhead, whereas Valtio eagerly proxies the entire state deeply.
- Troza only proxies arrays and plain objects, while Valtio also proxies class instances. Although Valtio’s approach can be beneficial, it may cause issues when proxying objects that shouldn’t be proxied (e.g., DOM nodes). Troza opts for simplicity, even if it means sacrificing a bit of flexibility.

### How does Troza compare to other state management libraries?

Troza is designed to be:

- **Immutable** since it still maintains an immutable state tree under the hood.
- **Intuitive** with mutable-style updates and auto dependency tracking.
- **Powerful** with its special support for computed states.
- **Encapsulated** by keeping state, computed states, and actions all in one place.
- **Composable** via straightforward syntax for slices.
- **TypeScript-friendly** with minimal type annotations required.

Compared to [Zustand](https://github.com/pmndrs/zustand), Troza offers:

- Support for cached computed states.
- Actions directly accessible on the store object.
- Intuitive syntax with mutable-style updates and auto dependency tracking.
- Enhanced TypeScript friendliness with fewer manual type annotations.
- Easier composition with a straightforward slice pattern.

Compared to [Valtio](https://github.com/pmndrs/valtio), Troza provides:

- Built-in support for _cached_ computed states.
- An encapsulated syntax with state, computed states, and actions all together.
- An immutable state tree under the hood rather than directly mutation.

However, note that Troza isn’t always the best choice for every application. If the proxy-based approach feels too magical or if you want to avoid any extra performance overhead, [Zustand](https://github.com/pmndrs/zustand) remains a simple and powerful alternative. For tiny, localized states instead of a centralized store, you might also consider [Jotai](https://github.com/pmndrs/jotai), and [Valtio](https://github.com/pmndrs/valtio) can be a great choice if you need more flexibility and control.

## License

This project is licensed under the Mozilla Public License Version 2.0 (MPL 2.0).
For details, please refer to the `LICENSE` file.

In addition to the open-source license, a commercial license is available for proprietary use.
If you modify this library and do not wish to open-source your modifications, or if you wish to use the modified library as part of a closed-source or proprietary project, you must obtain a commercial license.

For details, see `COMMERCIAL_LICENSE.md`.
