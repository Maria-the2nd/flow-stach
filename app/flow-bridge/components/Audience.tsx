export default function Audience() {
    return (
        <section className="fb-section" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="fb-container">
                <div className="fb-grid-2">
                    <div>
                        <span className="fb-section-label">Who it’s for</span>
                        <h2 className="fb-h2">Two markets. One tool.</h2>
                    </div>
                    <div></div>
                </div>

                <div className="fb-grid-2" style={{ marginTop: '40px', alignItems: 'flex-start' }}>
                    <div style={{ paddingRight: '40px' }}>
                        <h3 className="fb-h3">For AI users</h3>
                        <p className="fb-lead" style={{ fontSize: '1rem' }}>Founders, Marketers, Creators</p>
                        <p style={{ marginTop: '16px', color: 'rgba(0,0,0,0.65)' }}>
                            Stop getting trapped in “good enough”. Bring it into Webflow and make it real.
                        </p>
                    </div>
                    <div style={{ paddingLeft: '40px', borderLeft: '1px solid rgba(0,0,0,0.1)' }}>
                        <h3 className="fb-h3">For Webflow designers</h3>
                        <p className="fb-lead" style={{ fontSize: '1rem' }}>Agencies, Freelancers</p>
                        <p style={{ marginTop: '16px', color: 'rgba(0,0,0,0.65)' }}>
                            Ship faster without sacrificing craft. Use AI for velocity, Webflow for precision.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
