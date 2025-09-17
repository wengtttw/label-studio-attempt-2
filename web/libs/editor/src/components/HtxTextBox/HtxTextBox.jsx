import React from "react";
import { IconEdit, IconTrashAlt, IconCheck } from "@humansignal/icons";
import { Button, Tooltip, Typography } from "@humansignal/ui";
import throttle from "lodash/throttle";

// used for correct auto-height calculation
const BORDER_WIDTH = 1;

export class HtxTextBox extends React.Component {
  state = {
    editing: false,
    height: 0,
    value: this.props.text,
  };

  inputClassName =
    "text-color-neutral-content bg-neutral-surface border border-neutral-border px-base py-tight rounded-md w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-focus-outline leading-body-small";

  textRef = React.createRef();
  inputRef = React.createRef();

  static getDerivedStateFromProps(props, state) {
    if (props.text !== state.prevPropsText) {
      return {
        value: props.text,
        prevPropsText: props.text,
      };
    }
    return null;
  }

  componentDidMount() {
    window.addEventListener("click", this.handleGlobalClick, { capture: true });
  }

  componentWillUnmount() {
    window.removeEventListener("click", this.handleGlobalClick, { capture: true });
  }

  handleGlobalClick = (e) => {
    const el = e?.target;
    const isShortcut = el?.dataset?.shortcut;
    const shouldSkip =
      !this.state.editing || (this.props.ignoreShortcuts && isShortcut) || el === this.inputRef.current;

    if (!shouldSkip) {
      this.setEditing(false);
    }
  };

  startEditing = () => {
    const height = this.textRef.current?.parentNode.offsetHeight || 0;

    this.setState({ editing: true, height });

    // eslint-disable-next-line no-unused-expressions
    this.props.onStartEditing?.();

    setTimeout(this.focus);
  };

  focus = () => {
    const input = this.inputRef.current;

    if (input) input.selectionStart = this.state.value.length;
  };

  setEditing = (editing) => {
    this.setState({ editing });
  };

  setValue = (value) => {
    this.setState({ value });
  };

  cancel = () => {
    this.setValue(this.props.text);
    this.setEditing(false);
  };

  save = () => {
    this.props.onChange(this.state.value);
    this.setEditing(false);
  };

  updateHeight = throttle(() => {
    // very important to add borders to the height, otherwise input will be shrinking on every recalc
    const scrollHeight = this.inputRef.current?.scrollHeight ?? 0;
    const height = scrollHeight + BORDER_WIDTH * 2;

    // initially scrollHeight can be 0, so we won't change height
    if (scrollHeight && height !== this.state.height) {
      this.setState({ height });
    }
  }, 100);

  renderEdit() {
    const {
      className = "",
      rows = 1,
      onlyEdit,
      name,
      onFocus,
      onChange,

      // don't pass non-DOM props to Paragraph
      onDelete: _,
      isEditable: __,
      isDeleteable: ___,
      ignoreShortcuts: ____,
    } = this.props;
    const { height, value } = this.state;

    const inputProps = {
      name,
      className: `flex ${this.inputClassName}`,
      style: height ? { height, borderWidth: BORDER_WIDTH } : null,
      autoFocus: true,
      ref: this.inputRef,
      value,
      onBlur: () => {
        onChange(this.state.value);
      },
      onFocus,
      onChange: (e) => {
        this.setValue(e.target.value);
        this.updateHeight();
      },
      onKeyDown: (e) => {
        const { key, shiftKey } = e;

        if (key === "Enter") {
          // for multiline textarea save only by shift+enter
          if (+rows === 1 || shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            this.save();
          }
        } else if (key === "Escape") {
          this.cancel();
        } else if (key === "Tab") {
          this.setEditing(false);
        }
      },
    };

    this.updateHeight();

    return (
      <div className="grow p-0 relative">
        {rows > 1 ? <textarea {...inputProps} /> : <input {...inputProps} />}
        {!onlyEdit && (
          <Tooltip title="Save: [shift+enter]">
            <Button
              type="text"
              variant="neutral"
              look="string"
              size="small"
              className="absolute right-0 mr-4"
              style={{ bottom: "1px" }}
              icon={<IconCheck />}
              aria-label="Save"
              onClick={this.save}
            />
          </Tooltip>
        )}
      </div>
    );
  }

  renderView() {
    const {
      onChange,
      onDelete,
      isEditable,
      isDeleteable,
      text,

      // don't pass non-DOM props to Paragraph
      ignoreShortcuts: _,
      onlyEdit: __,

      ...props
    } = this.props;

    return (
      <>
        <div className={this.inputClassName} id={props.id} name={props.name}>
          <Typography ref={this.textRef} size="small">
            {text.split("\n").map((line, index, array) => {
              const isLastLine = index === array.length - 1;
              return (
                <React.Fragment key={index}>
                  {line}
                  {!isLastLine && <br />}
                </React.Fragment>
              );
            })}
          </Typography>
        </div>
        <div className="flex gap-tight pr-tight">
          {isEditable && onChange && (
            <Button
              type="text"
              variant="neutral"
              look="outlined"
              size="small"
              tooltip="Edit"
              tooltipTheme="Dark"
              leading={<IconEdit />}
              aria-label="Edit Region"
              onClick={this.startEditing}
            />
          )}
          {isDeleteable && onDelete && (
            <Button
              type="text"
              variant="negative"
              look="outlined"
              size="small"
              tooltip="Delete"
              tooltipTheme="Dark"
              leading={<IconTrashAlt />}
              aria-label="Delete Region"
              onClick={onDelete}
            />
          )}
        </div>
      </>
    );
  }

  render() {
    return (this.state.editing || this.props.onlyEdit) && this.props.isEditable ? this.renderEdit() : this.renderView();
  }
}
