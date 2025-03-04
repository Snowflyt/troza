import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createStore } from "../src";
import { hookify, useStore, useWatch } from "../src/react";

const createTestStore = () =>
  createStore({
    count: 0,
    text: "hello",
    items: [] as { id: number; text: string }[],
    computed: {
      doubled() {
        return this.count * 2;
      },
      itemCount() {
        return this.items.length;
      },
    },
    actions: {
      increment() {
        this.count += 1;
      },
      addItem(text: string) {
        this.items.push({ id: Date.now(), text });
      },
      setText(text: string) {
        this.text = text;
      },
    },
  });

afterEach(() => {
  cleanup();
});

describe("useStore hook", () => {
  test("selects and subscribes to state", () => {
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

  test("computed properties are accessible", () => {
    const store = createTestStore();

    const { result } = renderHook(() => useStore(store, (state) => state.doubled));

    expect(result.current).toBe(0);

    act(() => {
      store.increment();
    });

    expect(result.current).toBe(2);
  });

  test("returns full state when no selector is provided", () => {
    const store = createTestStore();

    const { result } = renderHook(() => useStore(store));

    // Should return the complete state
    expect(result.current).toHaveProperty("count", 0);
    expect(result.current).toHaveProperty("text", "hello");
    expect(result.current).toHaveProperty("items");
    expect(result.current).toHaveProperty("doubled", 0);
    expect(result.current).toHaveProperty("itemCount", 0);

    act(() => {
      store.increment();
    });

    // State should be updated
    expect(result.current).toHaveProperty("count", 1);
    expect(result.current).toHaveProperty("doubled", 2);
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

// Add this to the existing React integration tests

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
      const count = useTestStore((state) => state.count);

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
      const doubled = useTestStore((state) => state.doubled);
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

  test("components only rerender when selected data changes", () => {
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
      const count = useTestStore((state) => state.count);
      return <span data-testid="count">{count}</span>;
    }

    // Component that depends on text
    function TextDisplay() {
      renderCounts.text++;
      const text = useTestStore((state) => state.text);
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
