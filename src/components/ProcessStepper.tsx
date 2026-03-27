import { useLocation, useNavigate } from "react-router-dom";
import {
  Upload,
  ShieldAlert,
  ChartNoAxesCombined,
  Check,
  Sparkles,
} from "lucide-react";

type Step = {
  title: string;
  subtitle: string;
  path: string[];
  isImageIcon?: boolean;
  Icon: any;
};

const steps: Step[] = [
  {
    title: "Upload Data",
    subtitle: "Upload and process your CSV files",
    path: ["/upload"],
    Icon: Upload,
  },
  {
    title: "Field Mapping",
    subtitle: "Drag source fields to target fields",
    path: ["/field-mapping"],
    Icon: Sparkles,
  },
  {
    title: "Data Cleaning",
    subtitle: "Grouped issues with audit trail",
    path: ["/data-cleaning", "/data-analytics"],
    Icon: ShieldAlert,
  },
  {
    title: "Data Analytics",
    subtitle: "View the data as per the changes",
    path: ["/complete"],
    Icon: ChartNoAxesCombined,
  },
];

export default function ProcessStepper() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const currentStepIndex = steps.findIndex((s) =>
    s.path.some((p) => pathname.startsWith(p)),
  );
  let currentStep = currentStepIndex;
  if (currentStepIndex === -1) {
    currentStep = pathname.startsWith("/data-preview") ? 1 : 0;
  }

  console.log(pathname);
  console.log(currentStepIndex);
  console.log(currentStepIndex);

  return (
    <div className="grid md:grid-cols-4 gap-3">
      {steps.map((step, i) => {
        let state: "completed" | "active" | "upcoming" = "upcoming";
        if (i < currentStep) state = "completed";
        else if (i === currentStep) state = "active";

        const styles = {
          completed: {
            card: "bg-white border-slate-200",
            icon: "bg-primary/10 text-primary !border-1 border-primary ",
            title: "text-slate-900",
            subtitle: "text-slate-400",
          },
          active: {
            card: "bg-primary border-primary text-primary-foreground shadow-xs shadow-primary/20",
            icon: "bg-transparent text-primary-foreground border-white/50 !border-2",
            title: "text-white",
            subtitle: "text-primary-foreground/90",
          },
          upcoming: {
            card: "bg-white border-slate-200",
            icon: "bg-white text-slate-300 border-slate-200 border-2",
            title: "text-slate-500",
            subtitle: "text-slate-300",
          },
        }[state];

        return (
          <button
            key={step.path[0] ?? step.title}
            onClick={() => {
              const firstPath = step.path[0];
              if (!firstPath) return;
              if (i > currentStep) return;
              navigate(firstPath);
            }}
            className={`w-full p-1 !text-sm px-2 rounded-lg border text-left transition-all duration-300 ${styles.card} ${
              state === "active" ? "" : "hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-1 transition-colors duration-300 ${styles.icon}`}
              >
                {state === "completed" ? (
                  <Check size={20} strokeWidth={3} />
                ) : (
                  (() => {
                    if (step?.isImageIcon)
                      return (
                        <img
                          className="h-4 w-6"
                          src={step.Icon}
                          alt={step.title}
                        />
                      );
                    return <step.Icon size={16} />;
                  })()
                )}
              </span>

              <div className="min-w-0">
                <p
                  className={`font-normal text-sm leading-tight ${styles.title}`}
                >
                  {step.title}
                </p>
                <p
                  className={`text-[11px] mt-0.5 font-medium truncate ${styles.subtitle}`}
                >
                  {step.subtitle}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
