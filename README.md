<h1 align="center">Troza</h1>

`npm install troza` makes _intuitive_ state management easier than ever.

<p align="left">
  <a href="https://www.npmjs.com/package/troza">
    <img src="https://img.shields.io/npm/dm/troza.svg?style=flat&colorA=000000&colorB=000000" alt="downloads" height="18">
  </a>
  <a href="https://www.npmjs.com/package/troza">
    <img src="https://img.shields.io/npm/v/troza.svg?style=flat&colorA=000000&colorB=000000" alt="npm version" height="18">
  </a>
  <a href="https://bundlephobia.com/package/troza">
    <img src="https://img.shields.io/bundlephobia/minzip/troza.svg?label=bundle%20size&style=flat&colorA=000000&colorB=000000" alt="minzipped size" height="18">
  </a>
  <a href="https://coveralls.io/github/Snowflyt/troza?branch=main">
    <img src="https://img.shields.io/coverallsCoverage/github/Snowflyt/troza?branch=main&style=flat&colorA=000000&colorB=000000" alt="coverage status" height="18">
  </a>
  <a href="https://github.com/Snowflyt/troza">
    <img src="https://img.shields.io/npm/l/troza.svg?style=flat&colorA=000000&colorB=000000" alt="MPL 2.0 license" height="18">
  </a>
</p>

Troza simplifies state management with an intuitive API that unifies your state, **computed states**, and actions in one place. It automatically **tracks dependencies** and updates only the necessary parts of your UI.

- Operates on a single **immutable** state tree in a mutable style (powered by [Immer](https://github.com/immerjs/immer)).
- **Computed states** are cached and re-evaluated only when their dependencies change (powered by [proxy-compare](https://github.com/dai-shi/proxy-compare)).
- No need for `useShallow` as in [Zustand](https://github.com/pmndrs/zustand)—**memoized selectors** let you directly select multiple states without unnecessary rerenders.
- Actions are directly accessible via `store.action()`, hooks are not needed.
- Fully **TypeScript-friendly** with no extra type annotations required.
- Built-in **slice** support for better organization of your state.

You can try a live demo [here](https://githubbox.com/Snowflyt/troza/tree/main/examples/demo-react).

### First create a store

```typescript
import { createStore } from "troza";

const bookStore = createStore({
  reading: "Refactoring",
  bookshelf: {
    books: [
      { title: "Refactoring", pages: 448, read: true },
      { title: "Clean Code", pages: 464, read: false },
    ],
  },

  computed: {
    readBooks() {
      // Re-run only when `bookshelf.books` changes
      return this.bookshelf.books.filter((book) => book.read);
    },
  },

  actions: {
    changeReading(title: string) {
      this.reading = title;
    },
    markRead(title: string) {
      // Computed states can be accessed within actions or other computed states
      if (this.readBooks.some((book) => book.title === title)) {
        throw new Error("Book already read");
      }
      const book = this.bookshelf.books.find((book) => book.title === title);
      if (book) book.read = true;
    },
    addBook(title: string, pages: number) {
      const book = { title, pages, read: false };
      // The state, managed as an Immer draft, is accessible via `this`
      this.bookshelf.books.push(book);
      // You can also return a value from an action,
      // which is particularly useful for asynchronous operations
      return book;
    },
  },
});

export default bookStore;
```

### Then use the store in your components, and that’s it!

```tsx
import { useStore } from "troza/react";
import bookStore from "../stores/book";

const { changeReading, markRead, addBook } = bookStore;

function BookList() {
  const readingBook = useStore(bookStore, (state) => state.reading);
  // Retrieve computed state values
  const readBooks = useStore(bookStore, (state) => state.readBooks);

  // Selectors are memoized based on their dependencies, allowing you to
  // select multiple state slices without causing unnecessary re-renders
  const [bookshelf, tomes] = useStore(bookStore, (state) => [
    state.bookshelf,
    state.bookshelf.books.filter((book) => book.pages >= 300),
  ]);

  const [newTitle, setNewTitle] = React.useState("");
  const [newPages, setNewPages] = React.useState(300);
  const handleAddBook = () => {
    if (newTitle) {
      addBook(newTitle, newPages);
      setNewTitle("");
    }
  };

  // ...
}

export default BookList;
```

Also, check out the [`hookify`](#create-hooks-for-stores-to-avoid-boilerplate) utility to create custom hooks for your stores—this enhances compatibility with React DevTools and reduces boilerplate code.

## Recipes

### Create hooks for stores to avoid boilerplate

`useStore` is a straightforward way to use the store, but you can also create custom hooks using `hookify` to make your code more friendly to React DevTools and reduce boilerplate.

```typescript
import { createStore } from "troza";
import { hookify } from "troza/react";

const bookStore = createStore({
  /* ... */
});

export default bookStore;

export const useBookStore = hookify("book", bookStore);
```

The first argument of `hookify` is the store’s name, which helps during debugging. You can omit this argument if it’s not needed.

Then, you can use `useBookStore` in your components:

```typescript
import { useBookStore } from "../stores/book";

function BookList() {
  const readingBook = useBookStore((state) => state.reading);
  const readBooks = useBookStore((state) => state.readBooks);
  const [bookshelf, tomes] = useBookStore((state) => [
    state.bookshelf,
    state.bookshelf.books.filter((book) => book.pages >= 300),
  ]);

  // ...
}
```

### Select everything in the store

You can select the entire state of a store by not passing a selector function to `useStore` or your custom hook:

```typescript
import { useStore } from "troza/react";
import bookStore from "../stores/book";
import { useCounterStore } from "../stores/counter";

function Counter() {
  const bookState = useStore(bookStore);
  const counterState = useCounterStore();

  // ...
}
```

But be careful—this approach will cause the component to rerender whenever any part of the state changes, which can hurt performance.

### Select multiple states in a single selector

Troza selectors are memoized based on their auto-tracked dependencies, so you can directly select multiple state values without worrying about unnecessary re-renders.

```typescript
function BookList() {
  const [readingBook, readBooks] = useStore(bookStore, (state) => [state.reading, state.readBooks]);

  // You can also derive states directly in the selector,
  // eliminating the need for `useMemo`
  const tomes = useBookStore((state) =>
    // Re-run only when `bookshelf.books` changes
    state.bookshelf.books.filter((book) => book.pages >= 300),
  );

  // ...
}
```

Note that since selectors are memoized, they should depend solely on the store state and not on any external variables (e.g., `props` or states returned by `useState` or `useReducer`). If you need to use external variables, consider defining an unmemoized version of `useStore`.

<details>
  <summary>Click to see the unmemoized version of <code>useStore</code></summary>

```typescript
import type { Store, ComputedOptions, ExtractComputedReturns } from "troza";

export function useUnmemoizedStore<
  State extends object,
  Computed extends ComputedOptions,
  Actions extends Record<string, (...args: never) => unknown>,
  const Selected = State,
>(
  store: Store<State, Computed, Actions>,
  selector?: (state: Readonly<State & ExtractComputedReturns<Computed>>) => Selected,
): Selected {
  selector = selector || (state) => state as unknown as Selected;
  return React.useSyncExternalStore(
    (onStoreChange) => store.$subscribe(onStoreChange),
    () => selector(store.$get() as any),
    () => selector(store.$getInitialState() as any),
  );
}
```

</details>

### Async actions

You can define async actions in Troza without any extra effort:

```typescript
const store = createStore({
  loading: true,
  todos: [] as Array<{ id: number; title: string; completed: boolean }>,
  actions: {
    async fetchTodos() {
      const response = await fetch("https://jsonplaceholder.typicode.com/todos");
      const todos = await response.json();
      this.loading = false;
      this.todos = todos.slice(0, 10);
    },
  },
});
```

However, async actions prevent Troza from batching updates, which usually won’t cause extra re-renders but will trigger `$subscribe` on every update (see [the later section](#using-in-vanilla-JavaScript)). If you prefer to batch updates manually, you can use `this.$set`, `this.$patch` or `this.$update` (which are also accessible via `store.$set`, `store.$patch` and `store.$update`).

<details>
  <summary>Click to see an example of using <code>this.$set</code>, <code>this.$patch</code> and <code>this.$update</code></summary>

```typescript
const store = createStore({
  loading: true,
  todos: [] as Array<{ id: number; title: string; completed: boolean }>,
  actions: {
    async fetchTodos() {
      const response = await fetch("https://jsonplaceholder.typicode.com/todos");
      const todos = await response.json();
      this.$update((draft) => {
        // This is the immer draft of the state
        draft.loading = false;
        draft.todos = todos.slice(0, 10);
      });
      // Or
      this.$set({ loading: false, todos: todos.slice(0, 10) });
      // Or
      this.$set((prev) => ({
        ...prev,
        loading: false,
        todos: todos.slice(0, 10),
      }));
      // `$patch` is similar to `$set` but updates with partial state
      // this.$patch({ loading: false });
      // this.$patch((prev) => ({ loading: !prev.loading }));
    },
  },
});
```

Note that you don’t need to use `this.$set` or `this.$update` if you are using a synchronous action, as Troza will automatically batch updates for you.

</details>

### Slices pattern

The `createStore` function enforces the separation of state, computed states, and actions, which helps TypeScript infer types easily. This design works well for small stores, but as your store grows, you might want a logical separation of state rather than a strict physical one. In that case, the slices pattern is ideal:

```typescript
import { createSlice, createStore, withSlices } from "troza";

const counterSlice = createSlice({
  count: 0,
  actions: {
    increment() {
      this.count++;
    },
  },
});

const nameSlice = createSlice({
  name: "John Doe",
  actions: {
    changeName(name: string) {
      this.name = name;
    },
  },
});

const store = createStore(withSlices(counterSlice, nameSlice));
```

The `createSlice` function is used for type inference in TypeScript and simply returns the slice object. It is recommended to use this function even if you are developing a JavaScript-only application, which provides better completion in your editor.

### Using in vanilla JavaScript

Troza is a universal library, not tied to any specific framework, so you can use it in vanilla JavaScript as well. The React bindings are just simple wrappers around the core library.

Suppose you have a store like this:

```typescript
const store = createStore({
  count: 0,
  bookshelf: {
    books: [
      { title: "Refactoring", pages: 448, read: true },
      { title: "Clean Code", pages: 464, read: false },
    ],
  },

  computed: {
    doubleCount() {
      return this.count * 2;
    },
    readBooks() {
      return this.bookshelf.books.filter((book) => book.read);
    },
  },

  actions: {
    incBy(by: number) {
      this.count += by;
    },
    markRead(title: string) {
      if (this.readBooks.some((book) => book.title === title)) {
        throw new Error("Book already read");
      }
      const book = this.bookshelf.books.find((book) => book.title === title);
      if (book) book.read = true;
    },
    addBook(title: string, pages: number) {
      const book = { title, pages, read: false };
      this.bookshelf.books.push(book);
      return book;
    },
  },
});
```

You can use the following methods to interact with the store:

- `$get`: Retrieve the current state.
- `$getInitialState`: Retrieve the initial state.
- `$set`: Set the state directly.
- `$update`: Update the state using Immer.
- `$subscribe`: Subscribe to state changes.
- Actions: Call actions directly on the store.

For example:

```typescript
const state1 = store.$get();
// { count: 0, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }

// Call an action directly
store.incBy(2);

const state2 = store.$get();
// { count: 2, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }

// Each action creates a new state using Immer
console.log(state1 === state2); // false
console.log(state1); // { count: 0, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }

// Computed states are cached and only recalculated when their dependencies change
console.log(state1.doubleCount === state2.doubleCount); // false
console.log(state1.readBooks === state2.readBooks); // true

// Subscribe to changes
const unsubscribe = store.$subscribe((state, prevState) => {
  console.log("State changed\nm:", prevState, "\n", state);
});

store.inc();
// State changed
// from: { count: 2, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
// to: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
store.addBook("JavaScript: The Definitive Guide", 706);
// State changed
// from: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
// to: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
store.markRead("JavaScript: The Definitive Guide");
// State changed
// from: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
// to: { count: 3, bookshelf: [...], doubleCount: [Getter], readBooks: [Getter] }
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

### Caution on selectors, computed states, and mutable-style updates

Be aware that the magic of auto dependency tracking in selectors and computed states—and the mutable-style updates in Troza—is enabled through proxies. In selectors and computed states, `this` or `state` is a proxy created by [proxy-compare](https://github.com/dai-shi/proxy-compare) that tracks state dependencies. In actions, `this` is a proxy (an Immer draft) generated by [Immer](https://github.com/immerjs/immer), which lets you work with immutable state in a mutable manner.

Normally, this isn’t an issue because Troza automatically untracks the return value of selectors and computed states and undrafts the return value of actions. However, if you assign an intermediate value to an external variable, unexpected behavior may occur. For example:

```tsx
let selectedBook: { id: number; title: string; pages: number } | null = null;

const bookStore = createStore({
  books: [
    { id: 0, title: "Refactoring", pages: 448 },
    { id: 1, title: "Clean Code", pages: 464 },
  ],

  actions: {
    changeSelectedBook(id: number) {
      selectedBook = this.books[id];
    },
  },
});

function Bookshelf() {
  const [bookId, setBookId] = useState("");
  const books = useStore(bookStore, (state) => state.books);
  const [v, forceRerender] = useState(false);

  return (
    <>
      <div>{books.map(({ title, id }) => title + ` (${id})`).join(", ")}</div>
      {selectedBook && <div>selectedBook: {selectedBook.title}</div>}
      <input value={bookId} onChange={(e) => setBookId(e.target.value)} />
      <button
        type="button"
        onClick={() => {
          bookStore.changeSelectedBook(Number(bookId));
          forceRerender(!v);
        }}>
        Select book
      </button>
    </>
  );
}
```

When you select a book via the input and click the button, the `selectedBook` variable is assigned a proxy object—which is not what you expect. On the next render, the app would crash with an error like:

```text
Uncaught TypeError: illegal operation attempted on a revoked proxy
```

To obtain the proper value, you can use the `undraft` utility function to remove the proxy from the value:

```typescript
import { undraft } from "troza";

const bookStore = createStore({
  /* ... */
  actions: {
    changeSelectedBook(id: number) {
      selectedBook = undraft(this.books[id]);
    },
  },
});
```

Troza also provides an `untrack` utility that can be used in selectors and computed states to remove proxies. Remember: use `undraft` in actions to remove proxies from Immer drafts, and use `untrack` in selectors, computed states, subscribers and watchers.

Typically, you don’t need these utilities because Troza handles proxy removal automatically for the return value—only use them when assigning intermediate values to external variables, which is generally discouraged.

### Troza is more than a store

Troza isn’t just a library for store. It’s a state management library that offers a simple and intuitive API for managing state in your applications. You can either replace your entire state management with Troza or use it as a lightweight store for a specific part of your app.

Below is an interesting pattern that demonstrates how to replace all `useState`, `useMemo`, and `useEffect` hooks in a React application with Troza:

```typescript
import { createStore } from "troza";
import type { ComputedOptions, ExtractComputedReturns } from "troza";

export function useStateful<
  State extends object,
  Computed extends ComputedOptions = {},
  Actions extends Record<string, (...args: never) => unknown> = {},
>(
  sliceFactory: () => Parameters<typeof createStore<State, Computed, Actions>>[0],
): ReturnType<typeof createStore<State, Computed, Actions>> & {
  state: Readonly<Omit<State, "computed" | "actions"> & ExtractComputedReturns<Computed>>;
} {
  const store = React.useMemo(() => createStore(sliceFactory()), []);
  const state = React.useSyncExternalStore(
    (onStoreChange) => store.$subscribe(onStoreChange),
    () => store.$get(),
    () => store.$getInitialState(),
  );
  return { ...store, state } as any;
}
```

Then you can use it like this:

```tsx
function Counter() {
  const { incBy, state } = useStateful(() => ({
    count: 0,
    computed: {
      doubleCount() {
        return this.count * 2;
      },
    },
    actions: {
      incBy(by: number) {
        this.count += by;
      },
    },
  }));

  return (
    <div>
      <span>Count: {state.count}</span>
      <span>Double Count: {state.doubleCount}</span>
      <button onClick={() => incBy(1)}>Increment</button>
    </div>
  );
}
```

Or a more composable version:

```typescript
export function useStateful<State extends object>(initialState: State | (() => State)) {
  const store = useMemo(
    () =>
      createStore({
        ...(typeof initialState === "function" ? initialState() : initialState),
        actions: {
          act<R>(fn: (state: State) => R) {
            return fn(this as State);
          },
        },
      }),
    [],
  );
  const state = useSyncExternalStore(
    (onStoreChange) => store.$subscribe(onStoreChange),
    () => store.$get(),
    () => store.$getInitialState(),
  );

  const useComputed = <const Selected>(
    getter: (state: State) => Selected,
    deps: readonly unknown[] = [],
  ): Selected => useStore(store, useMemo(() => memoizeSelector(getter), deps) as any);

  const useAction =
    <F extends (...args: never) => unknown>(action: (state: State) => F): F =>
    (...args) =>
      store.act(action)(...args);

  return { state: state as State, useComputed, useAction };
}
```

Then you can use it like this:

```tsx
function Counter() {
  const { state, useAction, useComputed } = useStateful({ count: 0 });
  const { count } = state;
  const doubleCount = useComputed((state) => state.count * 2);
  const incBy = useAction((state) => (by: number) => {
    state.count += by;
  });

  return (
    <div>
      <span>Count: {count}</span>
      <span>Double Count: {doubleCount}</span>
      <button onClick={() => incBy(1)}>Increment</button>
    </div>
  );
}
```

While this pattern seems clean and interesting, remember that Troza is not specifically designed for such use cases. The demonstrated `useStateful` hook is only for illustration purposes and isn’t included in the library. For production, this hook would need further improvements to handle component props and other edge cases.

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
import { createStore } from "troza";
import { hookify } from "troza/react";

const counterStore = createStore({
  /* ... */
});

export default counterStore;

export const useCounterStore = hookify("counter", counterStore);
```

### Why `this` everywhere?

Though `this` in JavaScript sometimes gets a bad rep, not in Troza. Under the hood, Troza statically binds `this` to the store rather than dynamically binding it to the function context. This design lets you destructure actions directly from the store without manually binding `this`.

Using `this` makes the syntax cleaner and more TypeScript-friendly. Without it, you’d have to write something like `actionName: (state) => (...args) => {}` for every action or use less TypeScript-friendly patterns that require manual type annotations.

### Troza has a huge bundle size!

Troza is an _opinionated_ state management library that deeply integrates with [Immer](https://github.com/immerjs/immer) and [proxy-compare](https://github.com/dai-shi/proxy-compare), which makes it slightly larger than some other libraries. However, its minzipped size is around **6kB**, which is still small compared to libraries like MobX.

If your application already uses Immer—which is common in modern apps—Troza only adds about **2kB** to your bundle, making it a negligible addition.

### Why Troza over other state management libraries?

Troza is _not_ always the best choice for every application. It is designed to be intuitive with automatic dependency tracking and mutable-style updates, but that same magic can introduce extra complexity if it doesn’t fit your use case.

For instance, if you find yourself using `undraft` and `untrack` everywhere, it might be a sign that Troza isn’t the right tool for your needs. Automatic dependency tracking could also add performance overhead with very large state trees.

If you don’t need automatic dependency tracking or mutable-style updates, consider alternatives like [Zustand](https://github.com/pmndrs/zustand), which might be the simplest and most performant state management library for React. If you prefer tiny states rather than a centralized store, check out [Jotai](https://github.com/pmndrs/jotai). Also take a look at [Valtio](https://github.com/pmndrs/valtio) if you like proxy-based state management but prefer a more composable API.

## License

This project is licensed under the Mozilla Public License Version 2.0 (MPL 2.0).
For details, please refer to the `LICENSE` file.

In addition to the open-source license, a commercial license is available for proprietary use.
If you modify this library and do not wish to open-source your modifications, or if you wish to use the modified library as part of a closed-source or proprietary project, you must obtain a commercial license.

For details, see `COMMERCIAL_LICENSE.md`.
