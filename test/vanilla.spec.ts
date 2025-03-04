import { isDraft } from "immer";
import { describe, expect, test, vi } from "vitest";

import { createSlice, createStore, withSlices } from "../src";

describe("Basic State Management", () => {
  test("store should initialize with the provided state", () => {
    const store = createStore({
      count: 0,
      text: "hello",
    });

    expect(store.$get().count).toBe(0);
    expect(store.$get().text).toBe("hello");
  });

  test("$set should update the state", () => {
    const store = createStore({
      count: 0,
    });

    store.$set({ count: 5 });
    expect(store.$get().count).toBe(5);

    // Using function setter
    store.$set((state) => ({ count: state.count + 1 }));
    expect(store.$get().count).toBe(6);
  });

  test("$update should update the state using immer", () => {
    const store = createStore({
      count: 0,
      nested: { value: 10 },
    });

    store.$update((draft) => {
      draft.count += 1;
      draft.nested.value *= 2;
    });

    expect(store.$get().count).toBe(1);
    expect(store.$get().nested.value).toBe(20);
  });
});

describe("Computed States", () => {
  test("computed states should be calculated based on state", () => {
    const store = createStore({
      count: 5,
      computed: {
        doubled() {
          return this.count * 2;
        },
        tripled() {
          return this.count * 3;
        },
      },
    });

    expect(store.$get().doubled).toBe(10);
    expect(store.$get().tripled).toBe(15);
  });

  test("computed states should be cached and only recalculated when dependencies change", () => {
    const doubleSpy = vi.fn().mockImplementation(function (this: any) {
      return this.count * 2;
    });

    const tripleSpy = vi.fn().mockImplementation(function (this: any) {
      return this.count * 3;
    });

    const store = createStore({
      count: 5,
      name: "test",
      computed: {
        doubled: doubleSpy,
        tripled: tripleSpy,
      },
    });

    // First access should calculate
    expect(store.$get().doubled).toBe(10);
    expect(store.$get().tripled).toBe(15);
    expect(doubleSpy).toHaveBeenCalledTimes(1);
    expect(tripleSpy).toHaveBeenCalledTimes(1);

    // Second access should use cached value
    expect(store.$get().doubled).toBe(10);
    expect(store.$get().tripled).toBe(15);
    expect(doubleSpy).toHaveBeenCalledTimes(1);
    expect(tripleSpy).toHaveBeenCalledTimes(1);

    // Update a dependency
    store.$set((prev) => ({ ...prev, count: 10 }));

    // Should recalculate
    expect(store.$get().doubled).toBe(20);
    expect(store.$get().tripled).toBe(30);
    expect(doubleSpy).toHaveBeenCalledTimes(2);
    expect(tripleSpy).toHaveBeenCalledTimes(2);

    // Update unrelated state
    store.$set((prev) => ({ ...prev, name: "updated" }));

    // Should still use cached value
    expect(store.$get().doubled).toBe(20);
    expect(store.$get().tripled).toBe(30);
    expect(doubleSpy).toHaveBeenCalledTimes(2);
    expect(tripleSpy).toHaveBeenCalledTimes(2);
  });

  test("computed states can depend on other computed states", () => {
    const store = createStore({
      count: 2,
      computed: {
        doubled() {
          return this.count * 2;
        },
        quadrupled() {
          return this.doubled * 2;
        },
      },
    });

    expect(store.$get().doubled).toBe(4);
    expect(store.$get().quadrupled).toBe(8);

    store.$set({ count: 3 });

    expect(store.$get().doubled).toBe(6);
    expect(store.$get().quadrupled).toBe(12);
  });

  test("multi-level computed dependencies with objects are properly tracked and updated", () => {
    // Spies to track how many times each computed is called
    const filteredItemsSpy = vi.fn().mockImplementation(function (this: any) {
      return this.items
        .filter((item: any) => item.active)
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          value: item.value,
          processed: item.value * this.multiplier,
        }));
    });

    const statsSpy = vi.fn().mockImplementation(function (this: any) {
      return {
        count: this.filteredItems.length,
        total: this.filteredItems.reduce((sum: any, item: any) => sum + item.processed, 0),
        average:
          this.filteredItems.length > 0 ?
            this.filteredItems.reduce((sum: any, item: any) => sum + item.processed, 0) /
            this.filteredItems.length
          : 0,
        itemMap: new Map(this.filteredItems.map((item: any) => [item.id, item.processed])),
      };
    });

    const reportSpy = vi.fn().mockImplementation(function (this: any) {
      return {
        summary: `${this.stats.count} items with average value of ${this.stats.average.toFixed(1)}`,
        topItems: [...this.stats.itemMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([id, value]) => ({
            id,
            value,
            percentage: (value / this.stats.total) * 100,
          })),
        isValid: this.stats.count > 0 && this.stats.average > this.minimumAverage,
      };
    });

    const store = createStore({
      items: [
        { id: 1, name: "Item A", value: 10, active: true },
        { id: 2, name: "Item B", value: 20, active: true },
        { id: 3, name: "Item C", value: 30, active: false },
        { id: 4, name: "Item D", value: 40, active: true },
      ],
      multiplier: 2,
      minimumAverage: 25,
      computed: {
        // First level: Filter and transform items
        filteredItems: filteredItemsSpy,

        // Second level: Calculate statistics based on filtered items
        stats: statsSpy,

        // Third level: Generate report based on statistics
        report: reportSpy,
      },
    });

    // Initial computation
    const state1 = store.$get();

    expect(state1.filteredItems).toHaveLength(3);
    expect(state1.stats.total).toBe(140); // (10*2 + 20*2 + 40*2)
    expect(state1.stats.average).toBe(140 / 3);
    expect(state1.report.topItems).toHaveLength(2);
    expect(state1.report.topItems[0].id).toBe(4); // Item D has highest value
    expect(state1.report.isValid).toBe(true);

    expect(filteredItemsSpy).toHaveBeenCalledTimes(1);
    expect(statsSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledTimes(1);

    // Second access - all computed should use cache
    const state2 = store.$get();

    // References should be preserved
    expect(state1.filteredItems).toBe(state2.filteredItems);
    expect(state1.stats).toBe(state2.stats);
    expect(state1.report).toBe(state2.report);

    expect(filteredItemsSpy).toHaveBeenCalledTimes(1);
    expect(statsSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledTimes(1);

    // Change base state: update value of an item
    store.$update((draft) => {
      draft.items[0]!.value = 5; // Change Item A from 10 to 5
    });

    // All levels of computed should recalculate
    const state3 = store.$get();

    // Check that values propagated correctly
    expect(state3.filteredItems[0].processed).toBe(10); // 5*2
    expect(state3.stats.total).toBe(130); // (5*2 + 20*2 + 40*2)
    expect(state3.report.topItems[0].percentage).toBeCloseTo((80 / 130) * 100);

    expect(filteredItemsSpy).toHaveBeenCalledTimes(2);
    expect(statsSpy).toHaveBeenCalledTimes(2);
    expect(reportSpy).toHaveBeenCalledTimes(2);

    // Change multiplier (affects filteredItems but not base items)
    store.$update((draft) => {
      draft.multiplier = 3;
    });

    // All levels should recalculate again
    const state4 = store.$get();

    // Check new values with multiplier=3
    expect(state4.filteredItems[0].processed).toBe(15); // 5*3
    expect(state4.stats.total).toBe(195); // (5*3 + 20*3 + 40*3)
    expect(state4.report.topItems[0].percentage).toBeCloseTo((120 / 195) * 100);

    expect(filteredItemsSpy).toHaveBeenCalledTimes(3);
    expect(statsSpy).toHaveBeenCalledTimes(3);
    expect(reportSpy).toHaveBeenCalledTimes(3);

    // Change minimumAverage (only affects the third level computed)
    store.$update((draft) => {
      draft.minimumAverage = 70; // Above our current average
    });

    // Only the report should recalculate
    const state5 = store.$get();

    // First two levels should be the same reference
    expect(state4.filteredItems).toBe(state5.filteredItems);
    expect(state4.stats).toBe(state5.stats);
    expect(state4.report).not.toBe(state5.report);

    expect(filteredItemsSpy).toHaveBeenCalledTimes(3); // unchanged
    expect(statsSpy).toHaveBeenCalledTimes(3); // unchanged
    expect(reportSpy).toHaveBeenCalledTimes(4); // recalculated

    // Report should now be invalid
    expect(state5.report.isValid).toBe(false);

    // Change active state (affects first level filtered items)
    store.$update((draft) => {
      draft.items[2]!.active = true; // Make Item C active
    });

    // All levels should recalculate
    const state6 = store.$get();

    // Should now include Item C
    expect(state6.filteredItems).toHaveLength(4);
    expect(state6.stats.total).toBe(285); // (5*3 + 20*3 + 30*3 + 40*3)

    // Report should now be valid again
    expect(state6.report.isValid).toBe(true);
    expect(state6.report.summary).toBe("4 items with average value of 71.3");

    expect(filteredItemsSpy).toHaveBeenCalledTimes(4);
    expect(statsSpy).toHaveBeenCalledTimes(4);
    expect(reportSpy).toHaveBeenCalledTimes(5);
  });

  test("consecutive $get() calls should share the same computed instances", () => {
    const deepComputedSpy = vi.fn().mockImplementation(function (this: any) {
      // Return a nested object structure to ensure deep tracking
      return {
        items: this.data.items.map((item: any) => ({ id: item.id, doubled: item.value * 2 })),
        totalValue: this.data.items.reduce((sum: any, item: any) => sum + item.value, 0),
      };
    });

    const store = createStore({
      name: "test",
      data: {
        items: [
          { id: 1, value: 10 },
          { id: 2, value: 20 },
        ],
      },
      computed: {
        processedData: deepComputedSpy,
      },
    });

    // First get - should not compute
    const state1 = store.$get();
    expect(deepComputedSpy).toHaveBeenCalledTimes(0);

    store.$set((prev) => ({ ...prev, name: "updated" }));

    // Second get - should still not compute
    const state2 = store.$get();
    expect(deepComputedSpy).toHaveBeenCalledTimes(0);

    // References should be preserved
    expect(state1.processedData).toBe(state2.processedData);
    expect(state1.processedData.items).toBe(state2.processedData.items);

    // Get a third time, after accessing a property
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    state1.processedData.items[0];
    const state3 = store.$get();

    // Should still use cache
    expect(state3.processedData).toBe(state1.processedData);
    expect(deepComputedSpy).toHaveBeenCalledTimes(1);

    // Now modify state
    store.$update((draft) => {
      draft.data.items[0]!.value = 15;
    });

    // Get again - should recompute
    const state4 = store.$get();
    expect(state4.processedData).not.toBe(state1.processedData);
    expect(deepComputedSpy).toHaveBeenCalledTimes(2);
    expect(state4.processedData.totalValue).toBe(35); // 15 + 20
  });

  test("computed states can return complex objects that are properly tracked", () => {
    const objectSpy = vi.fn().mockImplementation(function (this: any) {
      return {
        sum: this.numbers.reduce((a: number, b: number) => a + b, 0),
        avg: this.numbers.reduce((a: number, b: number) => a + b, 0) / this.numbers.length,
        items: this.numbers.map((n: number) => ({ value: n, doubled: n * 2 })),
      };
    });

    const store = createStore({
      numbers: [1, 2, 3, 4],
      computed: {
        stats: objectSpy,
      },
    });

    // First access
    expect(store.$get().stats.sum).toBe(10);
    expect(store.$get().stats.avg).toBe(2.5);
    expect(store.$get().stats.items).toHaveLength(4);
    expect(store.$get().stats.items[2].doubled).toBe(6);
    expect(objectSpy).toHaveBeenCalledTimes(1);

    // Should use cached value
    expect(store.$get().stats.sum).toBe(10);
    expect(objectSpy).toHaveBeenCalledTimes(1);

    // Update dependency
    store.$update((draft) => {
      draft.numbers.push(5);
    });

    // Should recalculate
    expect(store.$get().stats.sum).toBe(15);
    expect(store.$get().stats.avg).toBe(3);
    expect(store.$get().stats.items).toHaveLength(5);
    expect(objectSpy).toHaveBeenCalledTimes(2);
  });

  test("untrack properly handles nested dependencies in computed properties", () => {
    const nestedSpy = vi.fn().mockImplementation(function (this: any) {
      // Deep access of nested properties to test tracking
      const total = this.users
        .filter((u: any) => !u.inactive)
        .flatMap((u: any) => u.orders)
        .reduce((sum: any, order: any) => sum + order.amount, 0);

      return {
        total,
        userCount: this.users.filter((u: any) => !u.inactive).length,
        orderCount: this.users.flatMap((u: any) => u.orders).length,
      };
    });

    const store = createStore({
      users: [
        {
          id: 1,
          name: "User 1",
          inactive: false,
          orders: [
            { id: 101, amount: 50 },
            { id: 102, amount: 30 },
          ],
        },
        {
          id: 2,
          name: "User 2",
          inactive: false,
          orders: [{ id: 201, amount: 20 }],
        },
      ],
      computed: {
        summary: nestedSpy,
      },
    });

    // First access
    expect(store.$get().summary.total).toBe(100);
    expect(store.$get().summary.userCount).toBe(2);
    expect(store.$get().summary.orderCount).toBe(3);
    expect(nestedSpy).toHaveBeenCalledTimes(1);

    // Modify a deeply nested property
    store.$update((draft) => {
      draft.users[0]!.orders[0]!.amount = 60;
    });

    // Should recalculate due to dependency change
    expect(store.$get().summary.total).toBe(110);
    expect(nestedSpy).toHaveBeenCalledTimes(2);

    // Modify an unrelated property
    store.$update((draft) => {
      draft.users[0]!.name = "Updated User 1";
    });

    // Should not recalculate since name isn't tracked
    expect(store.$get().summary.total).toBe(110);
    expect(nestedSpy).toHaveBeenCalledTimes(2);

    // Add a new user (changes structure)
    store.$update((draft) => {
      draft.users.push({
        id: 3,
        name: "User 3",
        inactive: false,
        orders: [{ id: 301, amount: 40 }],
      });
    });

    // Should recalculate
    expect(store.$get().summary.total).toBe(150);
    expect(store.$get().summary.userCount).toBe(3);
    expect(store.$get().summary.orderCount).toBe(4);
    expect(nestedSpy).toHaveBeenCalledTimes(3);
  });

  test("computed states correctly track array methods and property access", () => {
    const arraySpy = vi.fn().mockImplementation(function (this: any) {
      // Use various array methods to test tracking
      const filtered = this.items.filter((i: any) => i.value > 10);
      const mapped = filtered.map((i: any) => i.value * 2);
      const reduced = mapped.reduce((sum: any, val: any) => sum + val, 0);

      // Access array property
      const length = this.items.length;

      return { filtered, mapped, reduced, length };
    });

    const store = createStore({
      items: [
        { id: 1, value: 5 },
        { id: 2, value: 15 },
        { id: 3, value: 20 },
      ],
      computed: {
        processedData: arraySpy,
      },
    });

    // First access
    expect(store.$get().processedData.filtered).toHaveLength(2);
    expect(store.$get().processedData.mapped).toEqual([30, 40]);
    expect(store.$get().processedData.reduced).toBe(70);
    expect(store.$get().processedData.length).toBe(3);
    expect(arraySpy).toHaveBeenCalledTimes(1);

    // Update array item
    store.$update((draft) => {
      draft.items[0]!.value = 12;
    });

    // Should recalculate
    expect(store.$get().processedData.filtered).toHaveLength(3);
    expect(store.$get().processedData.reduced).toBe(94);
    expect(arraySpy).toHaveBeenCalledTimes(2);

    // Change array length by removing item
    store.$update((draft) => {
      draft.items.pop();
    });

    // Should recalculate due to structural change
    expect(store.$get().processedData.filtered).toHaveLength(2);
    expect(store.$get().processedData.length).toBe(2);
    expect(arraySpy).toHaveBeenCalledTimes(3);
  });

  test("Reflect.ownKeys is tracked in computed properties", () => {
    const ownKeysSpy = vi.fn().mockImplementation(function (this: any) {
      // Use Object.keys() which triggers Reflect.ownKeys tracking
      return Object.keys(this.config).length;
    });

    const store = createStore({
      config: { a: 1, b: 2, c: 3 },
      computed: {
        configSize: ownKeysSpy,
      },
    });

    // First access should compute
    expect(store.$get().configSize).toBe(3);
    expect(ownKeysSpy).toHaveBeenCalledTimes(1);

    // Second access should use cache
    expect(store.$get().configSize).toBe(3);
    expect(ownKeysSpy).toHaveBeenCalledTimes(1);

    // Adding a new key should invalidate cache because we tracked ownKeys
    store.$update((draft) => {
      (draft.config as any).d = 4;
    });

    // Should recompute
    expect(store.$get().configSize).toBe(4);
    expect(ownKeysSpy).toHaveBeenCalledTimes(2);

    // Changing a value but not keys shouldn't invalidate
    store.$update((draft) => {
      draft.config.a = 10;
    });

    // Should use cache
    expect(store.$get().configSize).toBe(4);
    expect(ownKeysSpy).toHaveBeenCalledTimes(2);
  });

  test("Reflect.has (in operator) is tracked in computed properties", () => {
    const hasPropSpy = vi.fn().mockImplementation(function (this: any) {
      // Use 'in' operator which triggers Reflect.has tracking
      return "admin" in this.user.roles;
    });

    const store = createStore({
      user: {
        roles: {
          user: true,
        },
      },
      computed: {
        isAdmin: hasPropSpy,
      },
    });

    // First access
    expect(store.$get().isAdmin).toBe(false);
    expect(hasPropSpy).toHaveBeenCalledTimes(1);

    // Second access should use cache
    expect(store.$get().isAdmin).toBe(false);
    expect(hasPropSpy).toHaveBeenCalledTimes(1);

    // Adding the tracked property should invalidate cache
    store.$update((draft) => {
      (draft.user.roles as any).admin = true;
    });

    // Should recompute
    expect(store.$get().isAdmin).toBe(true);
    expect(hasPropSpy).toHaveBeenCalledTimes(2);

    // Changing unrelated property shouldn't invalidate
    store.$update((draft) => {
      (draft.user.roles as any).superuser = true;
    });

    // Should use cache
    expect(store.$get().isAdmin).toBe(true);
    expect(hasPropSpy).toHaveBeenCalledTimes(2);
  });

  test("touchAffected handles complex nested dependencies", () => {
    // Testing that touchAffected correctly re-establishes nested dependencies
    const nestedComputedFn = vi.fn().mockImplementation(function (this: any) {
      const result = {
        total: 0,
        items: [],
      };

      // Nested access that should be tracked
      for (const category of Object.keys(this.inventory)) {
        for (const item of this.inventory[category]) {
          if ("price" in item) {
            result.total += item.price;
            result.items.push(item.name as never);
          }
        }
      }

      return result;
    });

    const store = createStore({
      inventory: {
        electronics: [
          { id: 1, name: "Laptop", price: 1000 },
          { id: 2, name: "Phone", price: 800 },
        ],
        furniture: [
          { id: 3, name: "Desk", price: 300 },
          { id: 4, name: "Chair", price: 200 },
        ],
      },
      computed: {
        inventoryStats: nestedComputedFn,
      },
    });

    // First access
    expect(store.$get().inventoryStats.total).toBe(2300);
    expect(store.$get().inventoryStats.items).toEqual(["Laptop", "Phone", "Desk", "Chair"]);
    expect(nestedComputedFn).toHaveBeenCalledTimes(1);

    // Second access should use cache
    expect(store.$get().inventoryStats.total).toBe(2300);
    expect(nestedComputedFn).toHaveBeenCalledTimes(1);

    // Update a nested property
    store.$update((draft) => {
      draft.inventory.electronics[0]!.price = 1200;
    });

    // Should recompute
    expect(store.$get().inventoryStats.total).toBe(2500);
    expect(nestedComputedFn).toHaveBeenCalledTimes(2);

    // Add a new category
    store.$update((draft) => {
      (draft.inventory as any).appliances = [{ id: 5, name: "Fridge", price: 1500 }];
    });

    // Should recompute because structure changed
    expect(store.$get().inventoryStats.total).toBe(4000);
    expect(store.$get().inventoryStats.items).toContain("Fridge");
    expect(nestedComputedFn).toHaveBeenCalledTimes(3);

    // Add a non-priced item (shouldn't affect total)
    store.$update((draft) => {
      draft.inventory.furniture.push({ id: 6, name: "Bookshelf" } as any);
    });

    // Should recompute (structure changed) but values remain as expected
    expect(store.$get().inventoryStats.total).toBe(4000);
    expect(store.$get().inventoryStats.items).not.toContain("Bookshelf");
    expect(nestedComputedFn).toHaveBeenCalledTimes(4);
  });

  test("multiple computeds with overlapping dependencies are properly tracked", () => {
    const namesSpy = vi.fn().mockImplementation(function (this: any) {
      return Object.keys(this.people);
    });

    const countSpy = vi.fn().mockImplementation(function (this: any) {
      return Object.keys(this.people).length;
    });

    const activeSpy = vi.fn().mockImplementation(function (this: any) {
      return Object.values(this.people).filter((p) => (p as any).active).length;
    });

    const store = createStore({
      people: {
        alice: { id: 1, active: true },
        bob: { id: 2, active: false },
        charlie: { id: 3, active: true },
      },
      computed: {
        names: namesSpy,
        count: countSpy,
        activeCount: activeSpy,
      },
    });

    // First access to each
    expect(store.$get().names).toEqual(["alice", "bob", "charlie"]);
    expect(store.$get().count).toBe(3);
    expect(store.$get().activeCount).toBe(2);
    expect(namesSpy).toHaveBeenCalledTimes(1);
    expect(countSpy).toHaveBeenCalledTimes(1);
    expect(activeSpy).toHaveBeenCalledTimes(1);

    // Add a person (affects names and count, not activeCount)
    store.$update((draft) => {
      (draft.people as any).dave = { id: 4, active: false };
    });

    expect(store.$get().names).toEqual(["alice", "bob", "charlie", "dave"]);
    expect(store.$get().count).toBe(4);
    expect(store.$get().activeCount).toBe(2);
    expect(namesSpy).toHaveBeenCalledTimes(2);
    expect(countSpy).toHaveBeenCalledTimes(2);
    expect(activeSpy).toHaveBeenCalledTimes(2); // Also recalculated due to structural change

    // Change activity status (affects only activeCount)
    store.$update((draft) => {
      draft.people.bob.active = true;
    });

    expect(store.$get().names).toEqual(["alice", "bob", "charlie", "dave"]);
    expect(store.$get().count).toBe(4);
    expect(store.$get().activeCount).toBe(3);
    expect(namesSpy).toHaveBeenCalledTimes(2);
    expect(countSpy).toHaveBeenCalledTimes(2);
    expect(activeSpy).toHaveBeenCalledTimes(3);
  });
});

describe("Actions", () => {
  test("actions can modify the state", () => {
    const store = createStore<
      { count?: number },
      {},
      {
        increment: () => void;
        add: (value: number) => void;
        removeCount: () => void;
      }
    >({
      count: 0,
      actions: {
        increment() {
          if (this.count !== undefined) this.count += 1;
        },
        add(value: number) {
          if (this.count !== undefined) this.count += value;
        },
        removeCount() {
          delete this.count;
        },
      },
    });

    store.increment();
    expect(store.$get().count).toBe(1);

    store.add(5);
    expect(store.$get().count).toBe(6);

    store.removeCount();
    expect(store.$get().count).toBe(undefined);
  });

  test("actions can access computed states", () => {
    const computedSpy = vi.fn().mockImplementation(function (this: any) {
      return this.count * 2;
    });

    const store = createStore({
      count: 1,
      result: 0,
      computed: {
        doubled: computedSpy,
      },
      actions: {
        storeDoubled() {
          // Simulate accessing twice
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          this.doubled;
          this.result = this.doubled;
        },
      },
    });

    store.storeDoubled();
    expect(store.$get().result).toBe(2);
    expect(computedSpy).toHaveBeenCalledTimes(1);
  });

  test("actions can call other actions", () => {
    const store = createStore({
      count: 0,
      actions: {
        increment() {
          this.count += 1;
        },
        incrementTwice() {
          this.increment();
          this.increment();
        },
      },
    });

    store.incrementTwice();
    expect(store.$get().count).toBe(2);
  });

  test("actions can return complex objects that are correctly undrafted", () => {
    interface Task {
      id: number;
      title: string;
      completed: boolean;
    }

    const store = createStore<
      { tasks: Task[] },
      {},
      {
        addTask: (title: string) => Task;
        getTasksInfo: () => {
          count: number;
          completedCount: number;
          activeTasks: Task[];
        };
      }
    >({
      tasks: [
        { id: 1, title: "Task 1", completed: false },
        { id: 2, title: "Task 2", completed: true },
      ],
      actions: {
        addTask(title: string) {
          const newTask = { id: this.tasks.length + 1, title, completed: false };
          this.tasks.push(newTask);
          return newTask; // Should be undrafted
        },
        getTasksInfo() {
          return {
            count: this.tasks.length,
            completedCount: this.tasks.filter((t) => t.completed).length,
            activeTasks: this.tasks.filter((t) => !t.completed),
          };
        },
      },
    });

    // Test returning a new created object
    const newTask = store.addTask("Task 3");
    expect(newTask).toEqual({ id: 3, title: "Task 3", completed: false });
    expect(isDraft(newTask)).toBe(false); // Should be undrafted

    // Test returning a complex object with nested arrays
    const info = store.getTasksInfo();
    expect(info.count).toBe(3);
    expect(info.completedCount).toBe(1);
    expect(info.activeTasks).toHaveLength(2);
    expect(isDraft(info)).toBe(false);
    expect(isDraft(info.activeTasks)).toBe(false);
    expect(isDraft(info.activeTasks[0])).toBe(false);
  });

  test("undraft handles circular references correctly", () => {
    interface Node {
      id: number;
      children: Node[];
      parent?: Node;
    }

    const store = createStore<
      { root: Node | null },
      {},
      {
        createTree: () => Node;
        getTree: () => Node | null;
      }
    >({
      root: null,
      actions: {
        createTree() {
          const root: Node = { id: 1, children: [] };
          const child1: Node = { id: 2, children: [], parent: root };
          const child2: Node = { id: 3, children: [], parent: root };

          root.children.push(child1);
          root.children.push(child2);

          // Create a circular reference
          const grandchild: Node = { id: 4, children: [], parent: child1 };
          child1.children.push(grandchild);

          this.root = root;
          return root; // Should handle circular refs
        },
        getTree() {
          return this.root; // Should undraft correctly
        },
      },
    });

    // Create a tree with circular references
    const tree = store.createTree();
    expect(tree.id).toBe(1);
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0]?.parent).toBeDefined();
    expect(tree.children[0]?.parent?.id).toBe(1);

    // Make sure circular references are handled
    expect(() => JSON.stringify(tree)).toThrow(); // Should throw because of circular refs

    // Get the tree again and verify it's properly undrafted
    const retrievedTree = store.getTree();
    expect(retrievedTree?.id).toBe(1);
    expect(retrievedTree?.children[0]?.parent).toBe(retrievedTree);
  });
});

describe("Async Actions", () => {
  test("async actions can update state asynchronously", async () => {
    const store = createStore<
      { count: number; loading?: boolean },
      {},
      { incrementAsync: (delay?: number) => Promise<number> }
    >({
      count: 0,
      loading: false,
      actions: {
        async incrementAsync(delay = 10) {
          this.loading = true;
          await new Promise((resolve) => setTimeout(resolve, delay));
          this.count += 1;
          delete this.loading;
          return this.count;
        },
      },
    });

    const promise = store.incrementAsync(10);
    expect(store.$get().loading).toBe(true);
    expect(store.$get().count).toBe(0);

    const result = await promise;
    expect(result).toBe(1);
    expect(store.$get().count).toBe(1);
    expect(store.$get().loading).toBe(undefined);
  });

  test("async actions can access computed states", async () => {
    const computedSpy = vi.fn().mockImplementation(function (this: any) {
      return this.count * 2;
    });

    const store = createStore({
      count: 1,
      computed: {
        doubled: computedSpy,
      },
      actions: {
        async storeDoubledAsync() {
          // Simulate accessing twice
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          this.doubled;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return this.doubled;
        },
      },
    });

    const promise = store.storeDoubledAsync();
    expect(computedSpy).toHaveBeenCalledTimes(1);

    const result = await promise;
    expect(result).toBe(2);
    expect(computedSpy).toHaveBeenCalledTimes(1);
  });

  test("async actions can call other actions", async () => {
    const actionSpy = vi.fn();

    const store = createStore({
      count: 0,
      actions: {
        increment() {
          this.count += 1;
          actionSpy();
        },
        async incrementTwiceAsync() {
          this.increment();
          await new Promise((resolve) => setTimeout(resolve, 10));
          this.increment();
          return this.count;
        },
      },
    });

    const promise = store.incrementTwiceAsync();
    expect(store.$get().count).toBe(1);
    expect(actionSpy).toHaveBeenCalledTimes(1);

    const result = await promise;
    expect(result).toBe(2);
    expect(store.$get().count).toBe(2);
    expect(actionSpy).toHaveBeenCalledTimes(2);
  });

  test("error in async actions won't corrupt the store", async () => {
    const store = createStore({
      count: 0,
      actions: {
        async failingAction() {
          this.count += 1;
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error("Intentional error");
        },
      },
    });

    await expect(store.failingAction()).rejects.toThrow("Intentional error");
    expect(store.$get().count).toBe(1); // The first update should still happen
  });
});

describe("Subscriptions", () => {
  test("$subscribe should call the subscriber when state changes", () => {
    const store = createStore({
      count: 0,
    });

    const subscriber = vi.fn();
    store.$subscribe(subscriber);

    store.$set({ count: 1 });
    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 0 }),
    );
  });

  test("$subscribe with selector should only call when selected state changes", () => {
    const store = createStore({
      count: 0,
      name: "test",
    });

    const countSubscriber = vi.fn();
    const nameSubscriber = vi.fn();

    store.$subscribe((state) => state.count, countSubscriber);
    store.$subscribe((state) => state.name, nameSubscriber);

    store.$set((prev) => ({ ...prev, count: 1 }));
    expect(countSubscriber).toHaveBeenCalledWith(1, 0);
    expect(nameSubscriber).not.toHaveBeenCalled();

    store.$set((prev) => ({ ...prev, name: "updated" }));
    expect(countSubscriber).toHaveBeenCalledTimes(1);
    expect(nameSubscriber).toHaveBeenCalledWith("updated", "test");
  });

  test("unsubscribe should stop the subscriber from being called", () => {
    const store = createStore({
      count: 0,
    });

    const subscriber = vi.fn();
    const unsubscribe = store.$subscribe(subscriber);

    store.$set({ count: 1 });
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribe();

    store.$set({ count: 2 });
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  test("$subscribe should throw TypeError if selector is not a function", () => {
    const store = createStore({
      count: 0,
    });

    expect(() => store.$subscribe("not a function" as any, () => {})).toThrow(
      new TypeError("The selector to $subscribe must be a function."),
    );

    expect(() => store.$subscribe(123 as any, () => {})).toThrow(
      new TypeError("The selector to $subscribe must be a function."),
    );

    expect(() => store.$subscribe({} as any, () => {})).toThrow(
      new TypeError("The selector to $subscribe must be a function."),
    );
  });

  test("$subscribe should throw TypeError if subscriber is not a function", () => {
    const store = createStore({
      count: 0,
    });

    expect(() => store.$subscribe(123 as any)).toThrow(
      new TypeError("The subscriber to $subscribe must be a function."),
    );

    expect(() => store.$subscribe({} as any)).toThrow(
      new TypeError("The subscriber to $subscribe must be a function."),
    );

    expect(() => store.$subscribe((state) => state.count, "not a function" as any)).toThrow(
      new TypeError("The subscriber to $subscribe must be a function."),
    );

    expect(() => store.$subscribe((state) => state.count, 123 as any)).toThrow(
      new TypeError("The subscriber to $subscribe must be a function."),
    );

    expect(() => store.$subscribe((state) => state.count, {} as any)).toThrow(
      new TypeError("The subscriber to $subscribe must be a function."),
    );
  });

  test("$subscribe with only one argument should use it as subscriber", () => {
    const store = createStore({
      count: 0,
    });

    const subscriber = vi.fn();
    const unsubscribe = store.$subscribe(subscriber);

    store.$set({ count: 1 });

    // Subscriber should receive the entire state object
    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 0 }),
    );

    // Make sure unsubscribe works
    unsubscribe();
    store.$set({ count: 2 });
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  test("$subscribe selector can return primitive or complex values", () => {
    const store = createStore({
      user: { name: "John", age: 30 },
      items: [1, 2, 3],
    });

    // Subscribe with primitive value selector
    const ageSubscriber = vi.fn();
    store.$subscribe((state) => state.user.age, ageSubscriber);

    // Subscribe with object selector
    const userSubscriber = vi.fn();
    store.$subscribe((state) => state.user, userSubscriber);

    // Subscribe with array selector
    const itemsSubscriber = vi.fn();
    store.$subscribe((state) => state.items, itemsSubscriber);

    // Update primitive in nested object
    store.$update((draft) => {
      draft.user.age = 31;
    });

    expect(ageSubscriber).toHaveBeenCalledWith(31, 30);
    expect(userSubscriber).toHaveBeenCalledTimes(1);
    expect(itemsSubscriber).not.toHaveBeenCalled();

    // Update array
    store.$update((draft) => {
      draft.items.push(4);
    });

    expect(ageSubscriber).toHaveBeenCalledTimes(1);
    expect(userSubscriber).toHaveBeenCalledTimes(1);
    expect(itemsSubscriber).toHaveBeenCalledTimes(1);
  });

  test("$subscribe with identical selector results should not trigger callback", () => {
    const store = createStore({
      a: { value: 1 },
      b: { value: 1 },
    });

    const subscriber = vi.fn();
    store.$subscribe((state) => state.a.value, subscriber);

    // Update with the same value
    store.$update((draft) => {
      draft.a.value = 1;
    });

    // Shouldn't call because value is the same (Object.is comparison)
    expect(subscriber).not.toHaveBeenCalled();

    // Update a different property
    store.$update((draft) => {
      draft.b.value = 2;
    });

    // Shouldn't call because we're not tracking b.value
    expect(subscriber).not.toHaveBeenCalled();

    // Update with different value
    store.$update((draft) => {
      draft.a.value = 2;
    });

    // Should call now
    expect(subscriber).toHaveBeenCalledWith(2, 1);
  });
});

describe("Watchers", () => {
  test("$watch should call the watcher when related state changes", () => {
    const store = createStore({
      count: 0,
      name: "test",
    });

    let count = 0;
    let prevCount = 0;
    let runCount = 0;
    const unwatch = store.$watch((state, prevState) => {
      runCount++;
      count = state.count;
      prevCount = prevState.count;
    });

    store.$set({ count: 1, name: "test" });
    expect(runCount).toBe(1);
    expect(count).toBe(1);
    expect(prevCount).toBe(0);

    store.$set({ count: 1, name: "updated" });
    expect(runCount).toBe(1); // Should not run again because count didn't change

    store.$set({ count: 2, name: "updated" });
    expect(runCount).toBe(2);
    expect(count).toBe(2);
    expect(prevCount).toBe(1);

    unwatch();

    store.$set({ count: 3, name: "updated" });
    expect(runCount).toBe(2); // Should not run again because we unsubscribed
  });

  test("$watch should throw TypeError if watcher is not a function", () => {
    const store = createStore({
      count: 0,
    });

    expect(() => store.$watch("not a function" as any)).toThrow(
      new TypeError("The watcher to $watch must be a function."),
    );

    expect(() => store.$watch(123 as any)).toThrow(
      new TypeError("The watcher to $watch must be a function."),
    );

    expect(() => store.$watch({} as any)).toThrow(
      new TypeError("The watcher to $watch must be a function."),
    );
  });
});

describe("Slices", () => {
  test("createSlice should create a type-safe slice", () => {
    const counterSlice = createSlice({
      count: 0,
      computed: {
        doubled() {
          return this.count * 2;
        },
      },
      actions: {
        increment() {
          this.count += 1;
        },
      },
    });

    const store = createStore(counterSlice);

    expect(store.$get().count).toBe(0);
    expect(store.$get().doubled).toBe(0);

    store.increment();
    expect(store.$get().count).toBe(1);
    expect(store.$get().doubled).toBe(2);
  });

  test("withSlices should merge multiple slices", () => {
    const counterSlice = createSlice({
      count: 0,
      computed: {
        doubled() {
          return this.count * 2;
        },
      },
      actions: {
        increment() {
          this.count += 1;
        },
      },
    });

    const userSlice = createSlice({
      user: {
        name: "test",
        age: 30,
      },
      computed: {
        isAdult() {
          return this.user.age >= 18;
        },
      },
      actions: {
        updateName(name: string) {
          this.user.name = name;
        },
      },
    });

    const mergedStore = createStore(withSlices(counterSlice, userSlice));

    expect(mergedStore.$get().count).toBe(0);
    expect(mergedStore.$get().user.name).toBe("test");
    expect(mergedStore.$get().doubled).toBe(0);
    expect(mergedStore.$get().isAdult).toBe(true);

    mergedStore.increment();
    mergedStore.updateName("updated");

    expect(mergedStore.$get().count).toBe(1);
    expect(mergedStore.$get().user.name).toBe("updated");
    expect(mergedStore.$get().doubled).toBe(2);
  });
});

describe("Edge Cases", () => {
  test("nested objects should be reactive", () => {
    const store = createStore({
      user: {
        profile: {
          name: "test",
          details: {
            age: 30,
          },
        },
      },
      actions: {
        updateAge(age: number) {
          this.user.profile.details.age = age;
        },
      },
    });

    store.updateAge(31);
    expect(store.$get().user.profile.details.age).toBe(31);
  });

  test("arrays should be reactive", () => {
    const store = createStore({
      items: [1, 2, 3],
      actions: {
        addItem(item: number) {
          this.items.push(item);
        },
        removeItem(index: number) {
          this.items.splice(index, 1);
        },
      },
    });

    store.addItem(4);
    expect(store.$get().items).toEqual([1, 2, 3, 4]);

    store.removeItem(1);
    expect(store.$get().items).toEqual([1, 3, 4]);
  });

  test("state should be immutable between updates", () => {
    const store = createStore({
      count: 0,
    });

    const state1 = store.$get();
    store.$set({ count: 1 });
    const state2 = store.$get();

    expect(state1).not.toBe(state2);
    expect(state1.count).toBe(0);
    expect(state2.count).toBe(1);
  });
});
