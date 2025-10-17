import * as React from "react";

export type ModalHandle = {
  update: (props?: Record<string, any>) => void;
  close: () => any;
};

export type ModalProps = Record<string, any>;

export function standaloneModal(props: ModalProps): ModalHandle;

export function confirm(opts: ModalProps & {
  okText?: string;
  onOk?: () => void;
  cancelText?: string;
  onCancel?: () => void;
  buttonLook?: string;
}): ModalHandle;

export function info(opts: ModalProps & { okText?: string; onOkPress?: () => void }): ModalHandle;

export const modal: typeof standaloneModal;

export const Modal: React.ForwardRefExoticComponent<ModalProps & React.RefAttributes<any>> & {
  info: typeof info;
  confirm: typeof confirm;
  modal: typeof standaloneModal;
};

export { modal as default };
