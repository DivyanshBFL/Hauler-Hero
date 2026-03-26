import { DotLottieReact } from "@lottiefiles/dotlottie-react";

type LoaderProps = {
    open: boolean;
    className?: string;
    blockInteraction?: boolean;
};

const Loader = ({
    open,
    className,
    blockInteraction = true,
}: LoaderProps) => {
    if (!open) return null;

    return (
        <div
            className={[
                "fixed h-screen w-screen z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.5)]",
                blockInteraction ? "pointer-events-auto" : "pointer-events-none",
                className ?? "",
            ].join(" ")}
            aria-busy="true"
            aria-live="polite"
            role="status"
        >
            <div className="w-[180px] h-[180px]">
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