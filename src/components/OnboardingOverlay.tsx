import { useState, useEffect } from "react";
import { Scan, Trash2, Shield } from "lucide-react";
import Button from "@/components/ui/Button";

const STORAGE_KEY = "aura-onboarding-done";

const steps = [
  {
    icon: null,
    title: "Welcome to Aura",
    description: "Your all-in-one system cleaner. Scan junk, find duplicates, manage privacy, and free up disk space — all from one beautiful interface.",
  },
  {
    icon: Scan,
    title: "Smart Scanning",
    description: "Run a SmartScan to check all categories at once, or dive into specific tools like Large Files, Duplicates, and Privacy from the sidebar.",
  },
  {
    icon: Trash2,
    title: "Safe Cleaning",
    description: "Items are moved to Trash by default so you can recover them. Enable permanent deletion in Settings if you prefer.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Everything runs locally on your machine. No data is sent anywhere. Aura respects your privacy.",
  },
];

export default function OnboardingOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setIsOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  }

  if (!isOpen) return null;

  const Step = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-surface border border-border-default rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center">
            {Step.icon ? (
              <Step.icon size={20} className="text-accent" />
            ) : (
              <img src="/app-icon.png" alt="" className="w-7 h-7 rounded-md" />
            )}
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary font-display">{Step.title}</h2>
            <div className="flex gap-1 mt-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === step ? "bg-accent" : "bg-border-default"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-[13px] text-text-secondary leading-relaxed mb-6">
          {Step.description}
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={dismiss}>
            Skip
          </Button>
          <Button
            variant="primary"
            onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
          >
            {isLast ? "Get Started" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
