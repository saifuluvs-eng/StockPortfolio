import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 10000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

const clearFromRemoveQueue = (toastId: string) => {
  const timeout = toastTimeouts.get(toastId)
  if (timeout) {
    clearTimeout(timeout)
    toastTimeouts.delete(toastId)
  }
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [
          action.toast,
          ...state.toasts.filter((toast) => toast.id !== action.toast.id),
        ].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Partial<Omit<ToasterToast, "id">> & { id?: string }

type ToastReturn = {
  id: string
  dismiss: () => void
  update: (props: ToasterToast) => void
}

type ToastFunction = ((props?: Toast) => ToastReturn) & {
  dismiss: (toastId?: string) => void
  success: (title: React.ReactNode, options?: Toast) => ToastReturn
  error: (title: React.ReactNode, options?: Toast) => ToastReturn
  loading: (title: React.ReactNode, options?: Toast) => ToastReturn
}

const createToast: (props?: Toast) => ToastReturn = (props = {}) => {
  const { id: providedId, onOpenChange, ...rest } = props
  const id = providedId ?? genId()

  clearFromRemoveQueue(id)

  const update = (toastProps: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...toastProps, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...rest,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
        onOpenChange?.(open)
      },
    },
  })

  return {
    id,
    dismiss,
    update,
  }
}

const toast = Object.assign(createToast, {
  dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  success: (title: React.ReactNode, options?: Toast) =>
    createToast({ ...options, title, variant: options?.variant ?? "default" }),
  error: (title: React.ReactNode, options?: Toast) =>
    createToast({
      ...options,
      title,
      variant: options?.variant ?? "destructive",
    }),
  loading: (title: React.ReactNode, options?: Toast) =>
    createToast({
      ...options,
      title,
      duration: options?.duration ?? 15000,
      variant: options?.variant ?? "default",
    }),
}) as ToastFunction

function useToast(): State & {
  toast: ToastFunction
  dismiss: (toastId?: string) => void
} {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => toast.dismiss(toastId),
  }
}

export { useToast, toast }
