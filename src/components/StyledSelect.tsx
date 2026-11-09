import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import "./styledSelect.css";

// Keep a native select as the form/event adapter; the visible menu is shared by
// every page, including dialogs and fullscreen player settings.
export function StyledSelect({
  children,
  className = "",
  style,
  id,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const uid = useId();
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [choices, setChoices] = useState<
    { value: string; label: string; disabled: boolean }[]
  >([]);
  const [selected, setSelected] = useState("");
  const [placement, setPlacement] = useState<React.CSSProperties>({});
  const search = useRef({ text: "", at: 0 });
  useLayoutEffect(() => {
    const select = native.current;
    if (!select) return;
    const next = Array.from(select.options).map((option) => ({
      value: option.value,
      label: option.text,
      disabled: option.disabled,
    }));
    setChoices((old) =>
      JSON.stringify(old) === JSON.stringify(next) ? old : next,
    );
    setSelected(select.value);
  }, [children, props.value]);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      const below = window.innerHeight - box.bottom - 16;
      const above = box.top - 16;
      const upward =
        below < Math.min(300, choices.length * 42 + 12) && above > below;
      const width = Math.min(Math.max(box.width, 190), window.innerWidth - 24);
      setPlacement({
        position: "fixed",
        width,
        left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
        maxHeight: Math.max(80, Math.min(320, upward ? above : below)),
        ...(upward
          ? { bottom: window.innerHeight - box.top + 6 }
          : { top: box.bottom + 6 }),
      });
    };
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    position();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, choices.length]);
  useLayoutEffect(() => {
    const list = menu.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!open || !list || !item) return;
    // Scroll only the menu, never the anime page behind it.
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  }, [active, open]);
  const choose = (index: number) => {
    const option = choices[index];
    if (!option || option.disabled || !native.current) return;
    native.current.value = option.value;
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
    setSelected(native.current.value);
    setOpen(false);
    trigger.current?.focus();
  };
  const show = () => {
    setActive(
      Math.max(
        0,
        choices.findIndex(
          (option) => option.value === selected && !option.disabled,
        ),
      ),
    );
    setOpen(true);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const enabled = choices
      .map((option, index) => (option.disabled ? -1 : index))
      .filter((index) => index >= 0);
    if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
      }
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) show();
      else {
        const at = enabled.indexOf(active);
        setActive(
          event.key === "Home"
            ? enabled[0]
            : event.key === "End"
              ? enabled[enabled.length - 1]
              : enabled[
                  (at + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) %
                    enabled.length
                ],
        );
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const now = Date.now();
      search.current = {
        text:
          (now - search.current.at < 700 ? search.current.text : "") +
          event.key.toLowerCase(),
        at: now,
      };
      const match = choices.findIndex(
        (option) =>
          !option.disabled &&
          option.label.toLowerCase().startsWith(search.current.text),
      );
      if (match >= 0) {
        setActive(match);
        setOpen(true);
      }
    }
  };
  const parent =
    trigger.current?.closest('[role="dialog"], .ReactModal__Content') ||
    document.fullscreenElement ||
    document.body;
  return (
    <span className="styled-select" style={style}>
      <select {...props} ref={native} hidden aria-hidden="true" tabIndex={-1}>
        {children}
      </select>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        className={`styled-select-trigger ${className}`}
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? `${uid}-menu` : undefined}
        aria-activedescendant={open ? `${uid}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (!menu.current?.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <span className="styled-select-value">
          {choices.find((option) => option.value === selected)?.label ||
            "Choose an option"}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={`${uid}-menu`}
            role="listbox"
            aria-label={props["aria-label"] || "Options"}
            className="styled-select-menu"
            style={placement}
            onMouseDown={(event) => event.preventDefault()}
          >
            {choices.map((option, index) => (
              <div
                key={`${option.value}-${index}`}
                id={`${uid}-${index}`}
                data-index={index}
                role="option"
                aria-selected={option.value === selected}
                aria-disabled={option.disabled || undefined}
                className={`styled-select-option${index === active ? " is-active" : ""}${option.value === "remove" ? " is-destructive" : ""}`}
                onPointerMove={() => !option.disabled && setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.value === selected ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <ChevronRight size={13} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>,
          parent,
        )}
    </span>
  );
}
