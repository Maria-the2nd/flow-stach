export default function Pricing() {
    return (
        <section id="pricing" className="fb-section">
            <div className="fb-container">
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <span className="fb-section-label">Pricing</span>
                    <h2 className="fb-h2">Start free. Upgrade when it clicks.</h2>
                </div>

                <div className="fb-grid-3">
                    <div className="fb-pricing-card">
                        <div className="fb-h3">Free</div>
                        <div className="fb-price">$0</div>
                        <p style={{ color: 'rgba(0,0,0,0.5)', marginBottom: '24px' }}>/ month</p>
                        <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <li>3 imports / month</li>
                            <li>Basic component breakdown</li>
                        </ul>
                        <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
                            <button className="fb-btn fb-btn-secondary" style={{ width: '100%' }}>Start Free</button>
                        </div>
                    </div>

                    <div className="fb-pricing-card featured">
                        <div className="fb-h3">Pro</div>
                        <div className="fb-price">$29</div>
                        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>/ month</p>
                        <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <li className="fb-list-item">Unlimited imports</li>
                            <li className="fb-list-item">Advanced parsing</li>
                            <li className="fb-list-item">Component naming rules</li>
                            <li className="fb-list-item">Team sharing</li>
                        </ul>
                        <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
                            <button className="fb-btn fb-btn-primary" style={{ width: '100%', backgroundColor: 'white', color: '#ff531f' }}>Get Pro</button>
                        </div>
                    </div>

                    <div className="fb-pricing-card">
                        <div className="fb-h3">Agency</div>
                        <div className="fb-price">$99</div>
                        <p style={{ color: 'rgba(0,0,0,0.5)', marginBottom: '24px' }}>/ month</p>
                        <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <li>Everything in Pro</li>
                            <li>5 seats included</li>
                            <li>Shared libraries</li>
                            <li>Priority support</li>
                        </ul>
                        <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
                            <button className="fb-btn fb-btn-secondary" style={{ width: '100%' }}>Contact Sales</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
