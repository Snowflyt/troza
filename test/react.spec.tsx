import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { create, get } from "../src";
import { hookify, useStore, useWatch } from "../src/react";

const createTestStore = () =>
  create({
    count: 0,
    text: "hello",
    items: [] as { id: number; text: string }[],

    [get("doubled")]() {
      return this.count * 2;
    },
    [get("itemCount")]() {
      return this.items.length;
    },

    increment() {
      this.count += 1;
    },
    addItem(id: number, text: string) {
      this.items = [...this.items, { id, text }];
    },
    setText(text: string) {
      this.text = text;
    },
  });

afterEach(() => {
  cleanup();
});

describe("useStore hook", () => {
  test("component only re-renders when accessed properties change", () => {
    const store = createTestStore();
    const renderCount = { value: 0 };

    function TestComponent() {
      renderCount.value++;
      // Only access count, not text or items
      const { count } = useStore(store);
      return <div data-testid="count">{count}</div>;
    }

    render(<TestComponent />);
    expect(renderCount.value).toBe(1);

    // Update accessed property (should cause re-render)
    act(() => {
      store.increment();
    });
    expect(renderCount.value).toBe(2);

    // Update non-accessed property (should not cause re-render)
    act(() => {
      store.setText("updated text");
    });
    expect(renderCount.value).toBe(2);

    // Update accessed property again
    act(() => {
      store.increment();
    });
    expect(renderCount.value).toBe(3);
  });

  test("deep property access is tracked correctly", () => {
    const complexStore = create({
      user: {
        profile: {
          name: "John",
          age: 30,
        },
        settings: {
          theme: "dark",
          notifications: true,
        },
      },
      updateName(name: string) {
        this.user = { ...this.user, profile: { ...this.user.profile, name } };
      },
      updateTheme(theme: string) {
        this.user = { ...this.user, settings: { ...this.user.settings, theme } };
      },
    });

    const renderCount = { value: 0 };

    function ProfileComponent() {
      renderCount.value++;
      // Only access user.profile, not user.settings
      const {
        user: { profile },
      } = useStore(complexStore);

      return (
        <div>
          <span data-testid="name">{profile.name}</span>
          <span data-testid="age">{profile.age}</span>
        </div>
      );
    }

    render(<ProfileComponent />);
    expect(renderCount.value).toBe(1);
    expect(screen.getByTestId("name").textContent).toBe("John");

    // Update accessed nested property
    act(() => {
      complexStore.updateName("Jane");
    });
    expect(renderCount.value).toBe(2);
    expect(screen.getByTestId("name").textContent).toBe("Jane");

    // Update non-accessed nested property
    act(() => {
      complexStore.updateTheme("light");
    });
    expect(renderCount.value).toBe(2); // Should not re-render
  });

  test("array access and iteration is tracked", () => {
    const store = createTestStore();
    const renderCount = { value: 0 };

    function ItemsComponent() {
      renderCount.value++;
      const { items } = useStore(store);

      return (
        <ul data-testid="items">
          {items.map((item) => (
            <li key={item.id} data-testid={`item-${item.id}`}>
              {item.text}
            </li>
          ))}
        </ul>
      );
    }

    render(<ItemsComponent />);
    expect(renderCount.value).toBe(1);

    // Add an item
    const firstId = Date.now();
    act(() => {
      store.addItem(firstId, "First item");
    });
    expect(renderCount.value).toBe(2);
    expect(screen.getByTestId(`item-${firstId}`).textContent).toBe("First item");

    // Add another item
    const secondId = Date.now() + 1;
    act(() => {
      store.addItem(secondId, "Second item");
    });
    expect(renderCount.value).toBe(3);
    expect(screen.getByTestId(`item-${secondId}`).textContent).toBe("Second item");

    // Update non-accessed property
    act(() => {
      store.increment();
    });
    expect(renderCount.value).toBe(3); // Should not re-render
  });

  test("computed properties are tracked correctly", () => {
    const store = createTestStore();
    const renderCount = { value: 0 };

    function ComputedComponent() {
      renderCount.value++;
      // Only access computed property
      const { doubled } = useStore(store);

      return <div data-testid="doubled">{doubled}</div>;
    }

    render(<ComputedComponent />);
    expect(renderCount.value).toBe(1);
    expect(screen.getByTestId("doubled").textContent).toBe("0");

    // Update dependency of the computed property
    act(() => {
      store.increment();
    });
    expect(renderCount.value).toBe(2);
    expect(screen.getByTestId("doubled").textContent).toBe("2");

    // Update non-dependency property
    act(() => {
      store.setText("updated text");
    });
    expect(renderCount.value).toBe(2); // Should not re-render
  });

  test("dynamic property access correctly updates tracking", () => {
    const store = createTestStore();
    const renderCount = { value: 0 };

    function DynamicComponent() {
      renderCount.value++;
      const [showCount, setShowCount] = useState(true);
      // Access different properties based on state
      const state = useStore(store);

      return (
        <div>
          <button data-testid="toggle" onClick={() => setShowCount(!showCount)}>
            Toggle
          </button>
          {showCount ?
            <span data-testid="value">{state.count}</span>
          : <span data-testid="value">{state.text}</span>}
        </div>
      );
    }

    render(<DynamicComponent />);
    expect(renderCount.value).toBe(1);
    expect(screen.getByTestId("value").textContent).toBe("0");

    // Update currently tracked property
    act(() => {
      store.increment();
    });
    expect(renderCount.value).toBe(2);
    expect(screen.getByTestId("value").textContent).toBe("1");

    // Toggle to track different property
    act(() => {
      fireEvent.click(screen.getByTestId("toggle"));
    });
    expect(renderCount.value).toBe(3);
    expect(screen.getByTestId("value").textContent).toBe("hello");

    // Now text updates should cause re-render, but count shouldn't
    act(() => {
      store.setText("updated text");
    });
    expect(renderCount.value).toBe(4);
    expect(screen.getByTestId("value").textContent).toBe("updated text");

    act(() => {
      store.increment();
    });
    expect(renderCount.value).toBe(4); // Should not re-render
  });

  test("reference stability when properties haven't changed", () => {
    const store = createTestStore();

    // Track references
    const references: { state: any; items: any }[] = [];

    function ReferenceComponent() {
      const state = useStore(store);

      // Store references for later comparison
      references.push({
        state,
        items: state.items,
      });

      return (
        <div>
          <span data-testid="count">{state.count}</span>
          <span data-testid="items-length">{state.items.length}</span>
        </div>
      );
    }

    const { rerender } = render(<ReferenceComponent />);

    // Re-render without state changes
    rerender(<ReferenceComponent />);

    // Reference should be stable across renders when nothing changes
    expect(references[0]!.state).toBe(references[1]!.state);
    expect(references[0]!.items).toBe(references[1]!.items);

    // Update count only
    act(() => {
      store.increment();
    });

    // State reference should change, but items reference should remain stable
    expect(references[1]!.state).not.toBe(references[2]!.state);
    expect(references[1]!.items).toBe(references[2]!.items);

    // Update items
    act(() => {
      store.addItem(Date.now(), "test item");
    });

    // Both references should change now
    expect(references[2]!.state).not.toBe(references[3]!.state);
    expect(references[2]!.items).not.toBe(references[3]!.items);
  });

  test("renders efficiently with multiple components using same store", () => {
    const store = createTestStore();
    const renderCounts = {
      countComponent: 0,
      textComponent: 0,
      itemsComponent: 0,
    };

    function CountComponent() {
      renderCounts.countComponent++;
      const { count } = useStore(store);
      return <div data-testid="count">{count}</div>;
    }

    function TextComponent() {
      renderCounts.textComponent++;
      const { text } = useStore(store);
      return <div data-testid="text">{text}</div>;
    }

    function ItemsComponent() {
      renderCounts.itemsComponent++;
      const { items } = useStore(store);
      return <div data-testid="items">{items.length}</div>;
    }

    render(
      <>
        <CountComponent />
        <TextComponent />
        <ItemsComponent />
      </>,
    );

    // Initial render
    expect(renderCounts.countComponent).toBe(1);
    expect(renderCounts.textComponent).toBe(1);
    expect(renderCounts.itemsComponent).toBe(1);

    // Update only count
    act(() => {
      store.increment();
    });
    expect(renderCounts.countComponent).toBe(2);
    expect(renderCounts.textComponent).toBe(1); // Unchanged
    expect(renderCounts.itemsComponent).toBe(1); // Unchanged

    // Update only text
    act(() => {
      store.setText("updated text");
    });
    expect(renderCounts.countComponent).toBe(2); // Unchanged
    expect(renderCounts.textComponent).toBe(2);
    expect(renderCounts.itemsComponent).toBe(1); // Unchanged

    // Update only items
    act(() => {
      store.addItem(Date.now(), "test item");
    });
    expect(renderCounts.countComponent).toBe(2); // Unchanged
    expect(renderCounts.textComponent).toBe(2); // Unchanged
    expect(renderCounts.itemsComponent).toBe(2);
  });

  test("subscribes to state with selectors", () => {
    const store = createTestStore();

    const { result } = renderHook(() => useStore(store, (state) => state.count));

    // Initial value
    expect(result.current).toBe(0);

    // Update state outside React
    act(() => {
      store.increment();
    });

    // Hook should reflect the updated state
    expect(result.current).toBe(1);

    // Test with a different selector
    const { result: textResult } = renderHook(() => useStore(store, (state) => state.text));
    expect(textResult.current).toBe("hello");

    // Update the text
    act(() => {
      store.setText("world");
    });

    // Check the updated value
    expect(textResult.current).toBe("world");
  });

  test("computed states are accessible in selectors", () => {
    const store = createTestStore();

    const { result } = renderHook(() => useStore(store, (state) => state.doubled));

    expect(result.current).toBe(0);

    act(() => {
      store.increment();
    });

    expect(result.current).toBe(2);
  });

  test("selector memoization prevents unnecessary rerenders", () => {
    const store = createTestStore();
    const renderCountRef = { count: 0 };

    // Create a component that counts renders
    function TestComponent() {
      renderCountRef.count++;

      // Select only count
      const count = useStore(store, (state) => state.count);
      return <div data-testid="count">{count}</div>;
    }

    render(<TestComponent />);
    expect(renderCountRef.count).toBe(1);
    expect(screen.getByTestId("count").textContent).toBe("0");

    // Update count
    act(() => {
      store.increment();
    });

    expect(renderCountRef.count).toBe(2);
    expect(screen.getByTestId("count").textContent).toBe("1");

    // Update text (unrelated to our selector)
    act(() => {
      store.setText("new text");
    });

    // Should not trigger a rerender
    expect(renderCountRef.count).toBe(2);
  });

  test("complex selectors with object returns", () => {
    const store = createTestStore();

    // Using an object selector
    const { rerender, result } = renderHook(() =>
      useStore(store, (state) => ({
        count: state.count,
        doubled: state.doubled,
      })),
    );

    expect(result.current).toEqual({ count: 0, doubled: 0 });

    act(() => {
      store.increment();
    });

    expect(result.current).toEqual({ count: 1, doubled: 2 });

    // Should not change the reference after rerender if dependencies haven’t changed
    const selected = result.current;

    act(() => {
      store.setText("new text");
    });

    rerender();

    expect(result.current).toBe(selected);
  });
});

describe("useWatch hook", () => {
  test("watches state changes and runs effect", () => {
    const store = createTestStore();
    const watchFn = vi.fn();

    const { unmount } = renderHook(() => useWatch(store, watchFn));

    // Should not be called immediately
    expect(watchFn).not.toHaveBeenCalled();

    // Update state
    act(() => {
      store.increment();
    });

    // Should be called with current and previous state
    expect(watchFn).toHaveBeenCalledTimes(1);
    expect(watchFn).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 0 }),
    );

    // Update state again
    act(() => {
      store.increment();
    });

    expect(watchFn).toHaveBeenCalledTimes(2);
    expect(watchFn).toHaveBeenLastCalledWith(
      expect.objectContaining({ count: 2 }),
      expect.objectContaining({ count: 1 }),
    );

    // Unmounting should stop the watcher
    unmount();

    act(() => {
      store.increment();
    });

    // Should not be called again after unmount
    expect(watchFn).toHaveBeenCalledTimes(2);
  });

  test("watcher tracks dependencies and only reruns when dependencies change", () => {
    const store = createTestStore();
    const watchFn = vi.fn((state) => {
      // Only track count, not text
      return state.count;
    });

    renderHook(() => useWatch(store, watchFn));

    // Change tracked state
    act(() => {
      store.increment();
    });
    expect(watchFn).toHaveBeenCalledTimes(1);

    // Change untracked state
    act(() => {
      store.setText("changed text");
    });

    // Should not trigger the watcher
    expect(watchFn).toHaveBeenCalledTimes(1);

    // Change tracked state again
    act(() => {
      store.increment();
    });

    // Should trigger watcher again
    expect(watchFn).toHaveBeenCalledTimes(2);
  });

  test("watcher can access computed values", () => {
    const store = createTestStore();
    const watchFn = vi.fn((state) => {
      // Access computed property
      return state.doubled;
    });

    renderHook(() => useWatch(store, watchFn));

    act(() => {
      store.increment();
    });

    expect(watchFn).toHaveBeenCalledTimes(1);
    expect(watchFn).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, doubled: 2 }),
      expect.objectContaining({ count: 0, doubled: 0 }),
    );
  });

  test("watcher with async function works properly", async () => {
    const store = createTestStore();
    let resolvePromise: () => void;

    const asyncWatchFn = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
    });

    renderHook(() => useWatch(store, asyncWatchFn));

    act(() => {
      store.increment();
    });

    expect(asyncWatchFn).toHaveBeenCalledTimes(1);

    // Resolve the promise
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      resolvePromise();
    });

    // Update again
    act(() => {
      store.increment();
    });

    expect(asyncWatchFn).toHaveBeenCalledTimes(2);
  });

  test("can integrate with React state", () => {
    const store = createTestStore();

    function TestComponent() {
      const [derived, setDerived] = useState(0);

      useWatch(store, (state) => {
        setDerived(state.count * 10);
      });

      return <div data-testid="derived">{derived}</div>;
    }

    render(<TestComponent />);

    expect(screen.getByTestId("derived").textContent).toBe("0");

    act(() => {
      store.increment();
    });

    expect(screen.getByTestId("derived").textContent).toBe("10");

    act(() => {
      store.increment();
    });

    expect(screen.getByTestId("derived").textContent).toBe("20");
  });
});

describe("hookify function", () => {
  test("creates a named hook that selects state", () => {
    const store = createTestStore();
    const useTestStore = hookify("test", store);

    // Check that the hook has the correct name
    expect(useTestStore.name).toBe("useTestStore");

    // Test using the hook
    const { result } = renderHook(() => useTestStore((state) => state.count));

    expect(result.current).toBe(0);

    act(() => {
      store.increment();
    });

    expect(result.current).toBe(1);
  });

  test("handles empty string name correctly", () => {
    const store = createTestStore();
    const useEmptyStore = hookify("", store);

    // Should capitalize the first letter even with empty name
    expect(useEmptyStore.name).toBe("useStore");

    // Test functionality still works
    const { result } = renderHook(() => useEmptyStore((state) => state.count));

    expect(result.current).toBe(0);

    act(() => {
      store.increment();
    });

    expect(result.current).toBe(1);
  });

  test("works with single-argument version", () => {
    const store = createTestStore();
    const useTestStore = hookify(store);

    // Check default hook name for anonymous store
    expect(useTestStore.name).toBe("useAnonymousStore");

    // Test using the hook
    const { result } = renderHook(() => useTestStore((state) => state.count));

    expect(result.current).toBe(0);

    act(() => {
      store.increment();
    });

    expect(result.current).toBe(1);
  });

  test("returns entire state when no selector provided", () => {
    const store = createTestStore();
    const useTestStore = hookify("test", store);

    const { result } = renderHook(() => useTestStore());

    // Should return the full state
    expect(result.current).toHaveProperty("count", 0);
    expect(result.current).toHaveProperty("text", "hello");
    expect(result.current).toHaveProperty("doubled", 0);

    act(() => {
      store.increment();
    });

    expect(result.current).toHaveProperty("count", 1);
    expect(result.current).toHaveProperty("doubled", 2);
  });
});

describe("Full component integration", () => {
  test("multiple components share the same store state", () => {
    const store = createTestStore();
    const useTestStore = hookify("test", store);

    // First component shows and updates count
    function Counter() {
      const { count } = useTestStore();

      return (
        <div>
          <span data-testid="count">{count}</span>
          <button data-testid="increment" onClick={() => store.increment()}>
            Increment
          </button>
        </div>
      );
    }

    // Second component shows doubled value
    function DoubledValue() {
      const { doubled } = useTestStore();
      return <span data-testid="doubled">{doubled}</span>;
    }

    // Render both components
    render(
      <>
        <Counter />
        <DoubledValue />
      </>,
    );

    // Initial values
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("doubled").textContent).toBe("0");

    // Click increment button
    fireEvent.click(screen.getByTestId("increment"));

    // Both components should update
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("doubled").textContent).toBe("2");
  });

  test("components only rerender when dependencies change", () => {
    const store = createTestStore();
    const useTestStore = hookify("test", store);

    // Component render counters
    const renderCounts = {
      counter: 0,
      text: 0,
    };

    // Component that depends on count
    function Counter() {
      renderCounts.counter++;
      const { count } = useTestStore();
      return <span data-testid="count">{count}</span>;
    }

    // Component that depends on text
    function TextDisplay() {
      renderCounts.text++;
      const { text } = useTestStore();
      return <span data-testid="text">{text}</span>;
    }

    // Render both components
    render(
      <>
        <Counter />
        <TextDisplay />
      </>,
    );

    // Initial render
    expect(renderCounts.counter).toBe(1);
    expect(renderCounts.text).toBe(1);

    // Update count
    act(() => {
      store.increment();
    });

    // Only Counter should rerender
    expect(renderCounts.counter).toBe(2);
    expect(renderCounts.text).toBe(1);

    // Update text
    act(() => {
      store.setText("updated");
    });

    // Only TextDisplay should rerender
    expect(renderCounts.counter).toBe(2);
    expect(renderCounts.text).toBe(2);
  });
});

describe("Error handling", () => {
  test("hookify throws error for invalid store", () => {
    expect(() => hookify("test", {} as any)).toThrow(TypeError);
    expect(() => hookify("test", { $get: "not a function" } as any)).toThrow(TypeError);
  });
});
