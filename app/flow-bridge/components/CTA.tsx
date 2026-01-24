import Link from "next/link";

export default function CTA() {
    return (
        <section className="fb-section" style={{ textAlign: 'center', padding: '120px 0' }}>
            <div className="fb-container">
                <h2 className="fb-h1" style={{ fontSize: '3.5rem', marginBottom: '24px' }}>Move fast. Make it yours.</h2>
                <p className="fb-lead" style={{ margin: '0 auto 40px auto' }}>
                    AI can generate the draft. Flow Bridge helps you own the final.
                </p>
                <Link href="/workspace/import" className="fb-btn fb-btn-primary" style={{ padding: '20px 48px', fontSize: '1.25rem' }}>
                    Try Flow Bridge
                </Link>
            </div>
        </section>
    );
}
