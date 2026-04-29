"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import React from "react";
import { StepIndicator } from "./step-indicator";
import { useWizard } from "./wizard-context";

interface WizardShellProps {
  children: React.ReactNode[];
  title?: string;
  subtitle?: string;
  onCancel?: () => void;
}

export function WizardShell({ children, title, subtitle, onCancel }: WizardShellProps) {
  const { currentStep, isFirstStep, steps } = useWizard();

  const stepContent = React.Children.toArray(children)[currentStep];
  const stepConfig = steps[currentStep];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-6">
          {title && <h1 className="text-2xl font-bold text-foreground">{title}</h1>}
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      )}

      {/* Step indicator */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-card mb-4">
        <StepIndicator />
      </div>

      {/* Step description (desktop only, shown in card) */}
      {stepConfig?.description && (
        <div className="hidden sm:block mb-4">
          <p className="text-sm text-muted-foreground">{stepConfig.description}</p>
        </div>
      )}

      {/* Step content */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-border">
          <h2 className="font-semibold text-foreground">{stepConfig?.title}</h2>
          {stepConfig?.description && (
            <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">{stepConfig.description}</p>
          )}
        </div>
        <div className="p-5 sm:p-6">{stepContent}</div>
      </div>

      {/* Cancel link */}
      {onCancel && isFirstStep && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}

interface WizardStepActionsProps {
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  isSubmit?: boolean;
}

export function WizardStepActions({
  onNext,
  onBack,
  nextLabel,
  backLabel = "Zurück",
  nextDisabled,
  loading,
  isSubmit,
}: WizardStepActionsProps) {
  const { isFirstStep, isLastStep, goBack } = useWizard();
  const handleBack = onBack ?? goBack;

  return (
    <div className={cn("flex items-center gap-3 pt-5 mt-2 border-t border-border", isFirstStep ? "justify-end" : "justify-between")}>
      {!isFirstStep && (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border bg-card hover:bg-accent px-4 py-2 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {backLabel}
        </button>
      )}

      {isSubmit ? (
        <button
          type="submit"
          disabled={nextDisabled || loading}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-6 py-2 rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {nextLabel ?? (isLastStep ? "Abschließen" : "Weiter")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-6 py-2 rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
          ) : null}
          {nextLabel ?? (isLastStep ? "Abschließen" : "Weiter")}
          {!isLastStep && !loading && <ChevronRight className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
