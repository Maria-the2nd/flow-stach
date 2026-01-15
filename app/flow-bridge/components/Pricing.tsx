import Link from "next/link";

export default function Pricing() {
    return (
        <section id="pricing" className="fb-section">
            <div className="fb-container">
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <span className="fb-section-label">Pricing</span>
                    <h2 className="fb-h2">Free for now. Paid plans coming soon.</h2>
                    <p className="fb-lead" style={{ margin: '0 auto', maxWidth: '600px' }}>
                        Flow Bridge is currently free to use. We&apos;re building paid plans with team features, unlimited imports, and more.
                    </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <Link href="/assets" className="fb-btn fb-btn-primary">
                        Get Started Free
                    </Link>
                </div>
            </div>
        </section>
    );
}
