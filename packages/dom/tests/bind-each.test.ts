// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { bindEach } from "../src/bind-each";

interface Item {
  id: string;
  label: string;
}

function setup(initial: Item[]) {
  const container = document.createElement("div");
  let items: Item[] = initial;
  const created = vi.fn((item: Item): HTMLElement => {
    const element = document.createElement("span");
    element.dataset.key = item.id;
    element.textContent = item.label;
    return element;
  });
  const updated = vi.fn((element: HTMLElement, item: Item) => {
    element.textContent = item.label;
  });

  const binding = bindEach<Item>(container, {
    items: () => items,
    key: (item) => item.id,
    create: created,
    update: updated,
  });

  return {
    container,
    binding,
    created,
    updated,
    setItems(next: Item[]): void {
      items = next;
    },
    keys(): (string | undefined)[] {
      return [...container.children].map((child) => (child as HTMLElement).dataset.key);
    },
  };
}

describe("bindEach", () => {
  it("creates one element per initial item, in order", () => {
    const world = setup([
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ]);
    world.binding.update();
    expect(world.keys()).toEqual(["a", "b"]);
    expect(world.created).toHaveBeenCalledTimes(2);
  });

  it("updates surviving keyed elements instead of recreating them", () => {
    const world = setup([{ id: "a", label: "A" }]);
    world.binding.update();
    const element = world.container.firstElementChild;

    world.setItems([{ id: "a", label: "A2" }]);
    world.binding.update();

    expect(world.created).toHaveBeenCalledTimes(1); // not recreated
    expect(world.container.firstElementChild).toBe(element); // same node
    expect(element?.textContent).toBe("A2");
    expect(world.updated).toHaveBeenCalledTimes(2); // every render
  });

  it("removes elements whose key disappeared", () => {
    const world = setup([
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ]);
    world.binding.update();
    world.setItems([{ id: "b", label: "B" }]);
    world.binding.update();
    expect(world.keys()).toEqual(["b"]);
  });

  it("reorders existing elements to match item order", () => {
    const world = setup([
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ]);
    world.binding.update();
    const [a, b, c] = [...world.container.children];

    world.setItems([
      { id: "c", label: "C" },
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ]);
    world.binding.update();

    expect(world.keys()).toEqual(["c", "a", "b"]);
    // Same nodes, only moved.
    expect([...world.container.children]).toEqual([c, a, b]);
    expect(world.created).toHaveBeenCalledTimes(3);
  });

  it("calls the remove hook before detaching", () => {
    const container = document.createElement("div");
    let items: Item[] = [{ id: "a", label: "A" }];
    const removed = vi.fn();
    const binding = bindEach<Item>(container, {
      items: () => items,
      key: (item) => item.id,
      create: () => document.createElement("span"),
      remove: removed,
    });

    binding.update();
    items = [];
    binding.update();

    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed.mock.calls[0][1]).toEqual({ id: "a", label: "A" });
    expect(container.children).toHaveLength(0);
  });

  it("keeps the element in the DOM until an async remove settles", async () => {
    const container = document.createElement("div");
    let items: Item[] = [{ id: "a", label: "A" }];
    let finish!: () => void;
    const binding = bindEach<Item>(container, {
      items: () => items,
      key: (item) => item.id,
      create: () => document.createElement("span"),
      remove: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });

    binding.update();
    items = [];
    binding.update();
    expect(container.children).toHaveLength(1); // exit animation playing

    finish();
    await Promise.resolve();
    expect(container.children).toHaveLength(0);
  });

  it("a key re-appearing during an exit animation gets a fresh element", async () => {
    const container = document.createElement("div");
    let items: Item[] = [{ id: "a", label: "A" }];
    const created = vi.fn(() => document.createElement("span"));
    const binding = bindEach<Item>(container, {
      items: () => items,
      key: (item) => item.id,
      create: created,
      remove: () => new Promise<void>(() => {}), // never settles
    });

    binding.update();
    items = [];
    binding.update();
    items = [{ id: "a", label: "A" }];
    binding.update();

    expect(created).toHaveBeenCalledTimes(2);
  });
});
