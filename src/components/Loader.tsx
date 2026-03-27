import { DotLottieReact } from "@lottiefiles/dotlottie-react";

type LoaderProps = {
  open: boolean;
  className?: string;
  blockInteraction?: boolean;
  inline?: boolean;
};

const Loader = ({
  open,
  className,
  blockInteraction = true,
  inline = false,
}: LoaderProps) => {
  if (!open) return null;

  return (
    <div
      className={[
        inline ? "absolute inset-0 z-50" : "fixed inset-0 z-[9999]",
        "flex items-center justify-center bg-[rgba(0,0,0,0.5)] backdrop-blur-[6px]",
        blockInteraction ? "pointer-events-auto" : "pointer-events-none",
        className ?? "",
      ].join(" ")}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="w-[100px] h-[100px]">
        <DotLottieReact
          src="https://lottie.host/916ede14-315e-4bac-91df-ddab7758c197/W7DXVNfhyG.lottie"
          loop
          autoplay
        />
      </div>
    </div>
  );
};

export default Loader;
