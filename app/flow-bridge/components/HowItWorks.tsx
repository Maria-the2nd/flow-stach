export default function HowItWorks() {
    const steps = [
        {
            step: "01",
            title: "Paste",
            desc: "Drop in your AI-generated HTML/CSS/JS."
        },
        {
            step: "02",
            title: "Componentize",
            desc: "We detect layout patterns and turn them into reusable blocks."
        },
        {
            step: "03",
            title: "Export to Webflow",
            desc: "Copy in Webflow-native format. Paste straight into the Designer."
        }
    ];

    return (
        <section id="how-it-works" className="fb-section">
            <div className="fb-container">
                <span className="fb-section-label">How it works</span>
                <h2 className="fb-h2">From AI output → Webflow canvas</h2>

                <div className="fb-grid-3" style={{ marginTop: '60px' }}>
                    {steps.map((s, i) => (
                        <div key={i} style={{ padding: '24px', borderLeft: '1px solid rgba(0,0,0,0.1)' }}>
                            <div style={{ fontFamily: 'Antonio', fontSize: '2rem', color: '#ff531f', marginBottom: '16px' }}>
                                {s.step}
                            </div>
                            <h3 className="fb-h3">{s.title}</h3>
                            <p style={{ color: 'rgba(26,26,26,0.65)' }}>{s.desc}</p>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '40px', textAlign: 'center' }}>
                    <button className="fb-btn fb-btn-secondary">See an example import</button>
                </div>
            </div>
        </section>
    );
}
