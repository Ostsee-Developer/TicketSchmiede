"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export interface WizardStepConfig {
  id: string;
  title: string;
  description?: string;
  optional?: boolean;
}

interface WizardContextValue {
  currentStep: number;
  totalSteps: number;
  steps: WizardStepConfig[];
  data: Record<string, unknown>;
  isFirstStep: boolean;
  isLastStep: boolean;
  goNext: (stepData?: Record<string, unknown>) => void;
  goBack: () => void;
  goToStep: (index: number) => void;
  setData: (key: string, value: unknown) => void;
  mergeData: (partial: Record<string, unknown>) => void;
  isCompleted: boolean;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used inside <WizardProvider>");
  return ctx;
}

interface WizardProviderProps {
  steps: WizardStepConfig[];
  initialData?: Record<string, unknown>;
  onComplete?: (data: Record<string, unknown>) => void | Promise<void>;
  children: React.ReactNode;
}

export function WizardProvider({
  steps,
  initialData = {},
  onComplete,
  children,
}: WizardProviderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setDataState] = useState<Record<string, unknown>>(initialData);
  const [isCompleted, setIsCompleted] = useState(false);

  const goNext = useCallback(
    (stepData?: Record<string, unknown>) => {
      if (stepData) {
        setDataState((prev) => ({ ...prev, ...stepData }));
      }
      if (currentStep < steps.length - 1) {
        setCurrentStep((s) => s + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setIsCompleted(true);
        const finalData = stepData ? { ...data, ...stepData } : data;
        onComplete?.(finalData);
      }
    },
    [currentStep, steps.length, data, onComplete],
  );

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        setCurrentStep(index);
      }
    },
    [steps.length],
  );

  const setData = useCallback((key: string, value: unknown) => {
    setDataState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const mergeData = useCallback((partial: Record<string, unknown>) => {
    setDataState((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <WizardContext.Provider
      value={{
        currentStep,
        totalSteps: steps.length,
        steps,
        data,
        isFirstStep: currentStep === 0,
        isLastStep: currentStep === steps.length - 1,
        goNext,
        goBack,
        goToStep,
        setData,
        mergeData,
        isCompleted,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}
