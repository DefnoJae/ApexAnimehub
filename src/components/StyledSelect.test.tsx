import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { StyledSelect } from "./StyledSelect";

test("styled menu updates the existing form handler, supports keyboard and dismisses outside", () => {
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const changed = jest.fn();
  function Form() {
    const [value, setValue] = useState("planning");
    return (
      <StyledSelect
        aria-label="List status"
        value={value}
        onChange={(event) => {
          changed(event.target.value);
          setValue(event.target.value);
        }}
      >
        <option value="planning">Planning</option>
        <option value="blocked" disabled>
          Unavailable
        </option>
        <option value="watching">Watching</option>
        <option value="remove">Remove from lists</option>
      </StyledSelect>
    );
  }
  const key = (value: string) =>
    act(() =>
      node
        .querySelector("button")!
        .dispatchEvent(
          new KeyboardEvent("keydown", {
            key: value,
            bubbles: true,
            cancelable: true,
          }),
        ),
    );
  try {
    act(() => root.render(<Form />));
    act(() => node.querySelector("button")!.click());
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    key("ArrowDown");
    key("Enter");
    expect(changed).toHaveBeenCalledWith("watching");
    expect(node.querySelector("button")!.textContent).toContain("Watching");
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    act(() => node.querySelector("button")!.click());
    key("Escape");
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    act(() => node.querySelector("button")!.click());
    act(() =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    key("p");
    key("Enter");
    expect(changed).toHaveBeenLastCalledWith("planning");
    expect(document.activeElement).toBe(node.querySelector("button"));
  } finally {
    act(() => root.unmount());
    node.remove();
  }
});
