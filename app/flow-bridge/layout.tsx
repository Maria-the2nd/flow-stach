import type { Metadata } from "next";
import "./flow-bridge.css";

export const metadata: Metadata = {
    title: "Flow Bridge - Turn AI websites into Webflow components",
    description: "AI can generate HTML/CSS/JS fast. Flow Bridge turns that output into clean, reusable components you can paste into Webflow.",
};

export default function FlowBridgeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
