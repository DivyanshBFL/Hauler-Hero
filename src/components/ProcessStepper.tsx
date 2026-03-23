import { useLocation, useNavigate } from "react-router-dom";
import {
  Upload,
  GitMerge,
  Table2,
  ShieldAlert,
  ChartNoAxesCombined,
} from "lucide-react";

type Step = {
  title: string;
  subtitle: string;
  path: string;
  Icon: React.ElementType;
};

const steps: Step[] = [
  {
    title: "Upload Data",
    subtitle: "Upload and process your CSV files",
    path: "/upload",
    Icon: Upload,
  },
  {
    title: "Field Mapping",
    subtitle: "Drag source fields to target entities",
    path: "/field-mapping",
    Icon: GitMerge,
  },
  {
    title: "Mapped Data Preview",
    subtitle: "Review data for processing",
    path: "/data-preview",
    Icon: Table2,
  },
  {
    title: "Data Cleaning",
    subtitle: "Grouped issues with audit trail",
    path: "/data-cleaning",
    Icon: ShieldAlert,
  },
  {
    title: "Data Analytics",
    subtitle: "View the data as per the changes",
    path: "/data-analytics",
    Icon: ChartNoAxesCombined,
  },
];

export default function ProcessStepper() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const currentStep =
    steps.findIndex((s) => pathname.startsWith(s.path)) ?? 0;

  return (
    <div className="grid md:grid-cols-5 gap-1">
      {steps.map((step, i) => {
        const state =
          i < currentStep ? "completed" : i === currentStep ? "active" : "upcoming";

        const styles = {
          completed: {
            card: "bg-blue-600 border-blue-600 text-white",
            icon: "bg-white text-blue-600 border-white",
            title: "text-white",
            subtitle: "text-blue-100",
          },
          active: {
            card: "bg-white border-blue-300",
            icon: "bg-blue-50 text-blue-600 border-blue-200",
            title: "text-blue-600",
            subtitle: "text-slate-500",
          },
          upcoming: {
            card: "bg-white border-slate-200",
            icon: "bg-white text-slate-400 border-slate-300",
            title: "text-slate-600",
            subtitle: "text-slate-400",
          },
        }[state];

        return (
          <button
            key={step.path}
            onClick={() => i <= currentStep && navigate(step.path)}
            className={`w-full p-2 rounded-lg border text-left transition shadow-md ${styles.card}`}
          >
            <div className="flex items-center gap-3">
              <span style={{ minWidth: "40px", minHeight: "40px" }}
                className={`flex h-10 w-10 items-center justify-center rounded-full border ${styles.icon}`}
              >
                <step.Icon size={18} />
              </span>

              <div className="min-w-0">
                <p className={`font-semibold text-sm ${styles.title}`}>
                  {step.title}
                </p>
                <p className={`text-xs truncate ${styles.subtitle}`}>
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