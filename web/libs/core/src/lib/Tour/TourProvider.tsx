import type React from "react";
import { createContext, useRef, useCallback, useReducer } from "react";
import type { Step } from "react-joyride";

/**
 * TourProvider manages the state and actions for product tours in the application.
 * It provides the core mechanics for:
 * - Managing tour states (running, stopped, current step, etc.)
 * - Handling tour actions (start, stop, next step, etc.)
 * - Maintaining references to multiple tours that can be registered
 *
 * The actual UI implementation is handled by the <Tour> component which uses this provider
 * to manage its state and behavior. The Tour component wraps react-joyride to render
 * the actual tour UI elements.
 */

interface TourState {
  key: string;
  run: boolean;
  continuous: boolean;
  loading: boolean;
  stepIndex: number;
  steps: Step[];
}

export interface TourAction {
  type: "START" | "RESET" | "STOP" | "GOTO" | "NEXT" | "RESTART";
  payload?: any;
}

const reducer = (state: TourState, action: TourAction): TourState => {
  switch (action.type) {
    case "START":
      return { ...state, run: true };
    case "RESET":
      return { ...state, stepIndex: 0 };
    case "STOP":
      return { ...state, run: false };
    case "NEXT": {
      const nextIndex = state.stepIndex + 1;
      if (nextIndex < state.steps.length) return { ...state, stepIndex: nextIndex };
      console.log(`Tour ${state.key} has no more steps`);
      return state;
    }
    case "GOTO":
      return { ...state, ...action.payload };
    case "RESTART":
      return {
        ...state,
        stepIndex: 0,
        run: true,
        loading: false,
        key: new Date().toISOString(),
      };
    default:
      return state;
  }
};

export const userTourStateReducer = (): [TourState, React.Dispatch<TourAction>] =>
  useReducer(reducer, createInitialState([]));

const createInitialState = (steps: Step[]): TourState => ({
  key: new Date().toISOString(),
  run: false,
  continuous: true,
  loading: false,
  stepIndex: 0,
  steps: steps.map((step) => ({
    ...step,
    // TODO: although html is predefined by LSE assets, to avoid XSS, we should better sanitize it by allowing only simple html tags like <b>, <i>, <u> etc.
    title: typeof step.title === "string" ? <div dangerouslySetInnerHTML={{ __html: step.title }} /> : step.title,
    content:
      typeof step.content === "string" ? <div dangerouslySetInnerHTML={{ __html: step.content }} /> : step.content,
  })),
});

type ProductTourState = "ready" | "skipped" | "completed";

const updateProductTourState = async (
  api: any,
  name: string,
  state: ProductTourState,
  interactionData: Record<string, any> = {},
) => {
  return await api.callApi("updateProductTour", {
    params: {
      name,
    },
    body: {
      state,
      interaction_data: interactionData,
    },
  });
};

interface TourContextType {
  registerTour: (name: string, dispatch: React.Dispatch<TourAction>) => void;
  unregisterTour: (name: string) => void;
  startTour: (name: string) => void;
  setTourViewed: (name: string, isSkipped: boolean, interactionData: Record<string, any>) => void;
  restartTour: (name: string) => void;
}

export const TourContext = createContext<TourContextType | null>(null);

// TODO: once useAPI is unified and moved into core library we need to come back and clean this up as it will not be necessary to pass it in to the provider
export const TourProvider: React.FC<{
  children: React.ReactNode;
  useAPI: () => { callApi: (apiName: string, params: Record<string, any>) => any };
}> = ({ children, useAPI }) => {
  const api = useAPI();
  const toursRef = useRef<Record<string, React.Dispatch<TourAction>>>({});

  const registerTour = (name: string, dispatch: React.Dispatch<TourAction>) => {
    toursRef.current[name] = dispatch;
  };

  const startTour = useCallback(
    async (name: string) => {
      const dispatch = toursRef.current[name];
      if (!dispatch) {
        console.error("Dispatch for tour", name, "not found");
        return;
      }

      const response = await api.callApi("getProductTour", { params: { name } });

      if (response?.$meta?.status !== 200) {
        console.error("Error fetching tour data", response);
        return;
      }

      if (response.awaiting) {
        console.info(`Tour "${name}" is awaiting other tours`);
        return;
      }

      if (!response.steps?.length) {
        console.info(`No steps found for tour "${name}"`);
        return;
      }

      if (response.state === "completed" || response.state === "skipped") {
        console.debug(`Tour "${name}" is already completed`);
        return;
      }

      const state = createInitialState(response.steps);
      dispatch({ type: "GOTO", payload: { ...state, run: true } });
    },
    [api],
  );

  const setTourViewed = useCallback(
    (name: string, isSkipped: boolean, interactionData: Record<string, any> = {}) => {
      // TODO: currently we don't have per-tour complete state, so we just update the global state
      updateProductTourState(api, name, isSkipped ? "skipped" : "completed", interactionData);
    },
    [api],
  );

  const restartTour = useCallback(
    (name: string) => {
      const dispatch = toursRef.current[name];
      if (!dispatch) {
        console.error("Dispatch for tour", name, "not found");
        return;
      }

      dispatch({ type: "RESTART" });

      updateProductTourState(api, name, "ready");
    },
    [api],
  );

  const unregisterTour = (name: string) => {
    delete toursRef.current[name];
  };

  return (
    <TourContext.Provider value={{ registerTour, unregisterTour, startTour, setTourViewed, restartTour }}>
      {children}
    </TourContext.Provider>
  );
};
