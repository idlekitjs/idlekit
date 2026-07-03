import { describe, it, expect } from "vitest";
import { Renderer } from "../src";
import { ReactiveStore } from "@idlekitjs/core";

describe("Renderer connected to a ReactiveStore", () => {
  it("initializes each binding once on the first render", () => {
    const store = new ReactiveStore({ a: 0, b: 0 });
    const renderer = new Renderer();
    renderer.connect(store);
    let a = 0;
    let b = 0;
    renderer.add({
      update: () => {
        void store.state.a;
        a += 1;
      },
    });
    renderer.add({
      update: () => {
        void store.state.b;
        b += 1;
      },
    });

    renderer.render();

    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it("only re-runs bindings whose read key changed", () => {
    const store = new ReactiveStore({ a: 0, b: 0 });
    const renderer = new Renderer();
    renderer.connect(store);
    let a = 0;
    let b = 0;
    renderer.add({
      update: () => {
        void store.state.a;
        a += 1;
      },
    });
    renderer.add({
      update: () => {
        void store.state.b;
        b += 1;
      },
    });
    renderer.render();

    store.state.a = 1;
    store.flush();
    renderer.render();

    expect(a).toBe(2);
    expect(b).toBe(1);
  });

  it("re-runs nothing when no relevant key changed", () => {
    const store = new ReactiveStore({ a: 0, b: 0 });
    const renderer = new Renderer();
    renderer.connect(store);
    let b = 0;
    renderer.add({
      update: () => {
        void store.state.b;
        b += 1;
      },
    });
    renderer.render();

    store.state.a = 5;
    store.flush();
    renderer.render();

    expect(b).toBe(1);
  });

  it("recollects dynamic dependencies on every run", () => {
    const store = new ReactiveStore({ flag: true, x: 0, y: 0 });
    const renderer = new Renderer();
    renderer.connect(store);
    let runs = 0;
    renderer.add({
      update: () => {
        runs += 1;
        void (store.state.flag ? store.state.x : store.state.y);
      },
    });
    renderer.render(); // deps = { flag, x }

    store.state.flag = false;
    store.flush();
    renderer.render(); // re-reads -> deps = { flag, y }
    expect(runs).toBe(2);

    runs = 0;
    store.state.x = 99; // x is no longer a dependency
    store.flush();
    renderer.render();
    expect(runs).toBe(0);

    store.state.y = 7; // y is a dependency
    store.flush();
    renderer.render();
    expect(runs).toBe(1);
  });

  it("initializes a binding added after the first render", () => {
    const store = new ReactiveStore({ a: 0 });
    const renderer = new Renderer();
    renderer.connect(store);
    renderer.render();

    let late = 0;
    renderer.add({
      update: () => {
        void store.state.a;
        late += 1;
      },
    });
    renderer.render();

    expect(late).toBe(1);
  });

  it("fallback: without a connected store, re-runs every binding on each render", () => {
    const renderer = new Renderer();
    let runs = 0;
    renderer.add({ update: () => (runs += 1) });

    renderer.render();
    renderer.render();

    expect(runs).toBe(2);
  });

  it("runs frame bindings on every render, bypassing dependency tracking", () => {
    const store = new ReactiveStore({ a: 0 });
    const renderer = new Renderer();
    renderer.connect(store);

    let tracked = 0;
    let frames = 0;
    renderer.add({
      update: () => {
        void store.state.a;
        tracked += 1;
      },
    });
    renderer.addFrame({ update: () => (frames += 1) });

    renderer.render(); // first frame: both run
    renderer.render(); // nothing dirty: only the frame binding runs
    renderer.render();

    expect(tracked).toBe(1);
    expect(frames).toBe(3);
  });
});
