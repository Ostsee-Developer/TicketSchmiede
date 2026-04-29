"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useWizard } from "./wizard-context";

export function StepIndicator() {
  const { steps, currentStep, goToStep } = useWizard();

  return (
    <div className="w-full">
      {/* Desktop: horizontal steps */}
      <div className="hidden sm:flex items-center gap-0">
        {steps.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          const isClickable = i < currentStep;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              {/* Step node */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && goToStep(i)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 shrink-0",
                  isClickable && "cursor-pointer group",
                  !isClickable && "cursor-default",
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all",
                    isDone && "border-primary bg-primary text-primary-foreground",
                    isActive && "border-primary bg-primary/10 text-primary ring-4 ring-primary/20",
                    !isDone && !isActive && "border-border bg-card text-muted-foreground",
                    isClickable && "group-hover:border-primary/70",
                  )}
                >
                  {isDone ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <div className="text-center max-w-[80px]">
                  <p
                    className={cn(
                      "text-xs font-medium leading-tight",
                      isActive && "text-primary",
                      isDone && "text-foreground",
                      !isDone && !isActive && "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </p>
                </div>
              </button>

              {/* Connector line (not after last) */}
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 mt-[-1.5rem] transition-colors",
                    i < currentStep ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: compact indicator */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">
            {steps[currentStep]?.title}
          </span>
          <span className="text-xs text-muted-foreground">
            Schritt {currentStep + 1} von {steps.length}
          </span>
        </div>
        <div className="flex gap-1 h-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-full transition-all duration-300",
                i <= currentStep ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>
        {steps[currentStep]?.description && (
          <p className="text-xs text-muted-foreground mt-2">{steps[currentStep].description}</p>
        )}
      </div>
    </div>
  );
}
