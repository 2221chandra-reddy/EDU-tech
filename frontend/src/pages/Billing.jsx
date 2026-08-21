import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { billingApi } from '../api/client';
import { PageHeader, LoadingBlock } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Could not load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

export default function Billing() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [catalog, setCatalog] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [cat, me] = await Promise.all([billingApi.catalog(), billingApi.me().catch(() => null)]);
    setCatalog(cat);
    if (me?.user) setUser(me.user);
    setHistory(me?.history || []);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function payRazorpay() {
    setBusy(true);
    try {
      const order = await billingApi.order();
      if (order.mode === 'demo') {
        const paid = await billingApi.demoPay();
        setUser(paid.user);
        toast.success('Premium activated (demo payment)');
        await load();
        return;
      }
      if (order.mode === 'manual') {
        toast.error('Razorpay is not configured yet. Ask admin to add keys, or they can set your plan to Premium.');
        return;
      }
      const Razorpay = await loadRazorpay();
      await new Promise((resolve, reject) => {
        const rzp = new Razorpay({
          key: order.key_id,
          amount: order.amount_paise,
          currency: order.currency,
          name: 'EduGate Premium',
          description: `${order.days} days of unlimited AI + live CBTs`,
          order_id: order.order_id,
          prefill: { name: user?.name, email: user?.email },
          handler: async (response) => {
            try {
              const verified = await billingApi.verify(response);
              setUser(verified.user);
              toast.success('Payment successful — Premium is active');
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => resolve() },
        });
        rzp.on('payment.failed', (resp) => {
          reject(new Error(resp?.error?.description || 'Payment failed'));
        });
        rzp.open();
      });
      await load();
    } catch (err) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  if (!catalog) return <LoadingBlock />;

  const expired = user?.plan_expired;
  const premium = user?.entitlements?.premium;
  const days = user?.days_left;

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Plan & payments"
        subtitle="Free trial first. After it ends, Premium unlocks unlimited AI Coach and live CBTs."
      />

      <div className="mb-6 rounded-2xl bg-white p-5">
        <div className="text-xs uppercase tracking-wider text-slate">Current plan</div>
        <div className="mt-1 font-display text-2xl capitalize text-forest">
          {premium ? 'Premium' : expired ? 'Free trial ended' : 'Free trial'}
        </div>
        <p className="mt-1 text-sm text-slate">
          {premium
            ? `${days} days left · renews by paying again before expiry.`
            : expired
              ? 'AI Coach and live exams are paused until you upgrade.'
              : `${days} day${days === 1 ? '' : 's'} left on your free trial.`}
        </p>
        {user?.plan_expires_at && (
          <p className="mt-1 text-xs text-slate">Expires {String(user.plan_expires_at).slice(0, 10)}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-forest/10 bg-white p-6">
          <h2 className="font-display text-xl text-forest">{catalog.free.name}</h2>
          <p className="mt-1 text-sm text-slate">{catalog.free.days} days from signup</p>
          <ul className="mt-4 space-y-2 text-sm text-forest">
            {catalog.free.includes.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-forest p-6 text-sand">
          <h2 className="font-display text-xl text-amber-soft">{catalog.premium.name}</h2>
          <p className="mt-1 text-3xl font-semibold">
            ₹{catalog.premium.price_inr}
            <span className="ml-2 text-sm font-normal text-mint/80">/ {catalog.premium.days} days</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-mint">
            {catalog.premium.includes.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={payRazorpay}
            className="mt-6 w-full rounded-xl bg-amber px-4 py-3 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {busy ? 'Opening checkout…' : premium ? 'Extend Premium' : 'Pay & activate Premium'}
          </button>
          {!catalog.razorpay_configured && catalog.demo_pay_allowed && (
            <p className="mt-3 text-xs text-mint/70">
              Razorpay keys are not set yet — this uses a demo checkout for local testing.
            </p>
          )}
          {!catalog.razorpay_configured && !catalog.demo_pay_allowed && (
            <p className="mt-3 text-xs text-mint/70">
              Live payments need RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the API. Until then, admin can grant Premium.
            </p>
          )}
        </div>
      </div>

      {!!history.length && (
        <section className="mt-8">
          <h3 className="mb-3 font-display text-lg text-forest">Payment history</h3>
          <div className="overflow-x-auto rounded-2xl bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest/10 text-xs uppercase text-slate">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-b border-forest/5">
                    <td className="px-4 py-3">{String(p.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-4 py-3">₹{p.amount_inr}</td>
                    <td className="px-4 py-3 capitalize">{p.provider}</td>
                    <td className="px-4 py-3 capitalize">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export function Pricing() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    billingApi.catalog().then(setCatalog).catch(console.error);
  }, []);

  if (!catalog) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeader
        eyebrow="Pricing"
        title="Start free. Upgrade when the trial ends."
        subtitle="Admin controls free-trial length and Premium price. AWS S3 for PDFs is a later storage budget — not required for billing."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6">
          <h2 className="font-display text-2xl text-forest">Free trial</h2>
          <p className="mt-2 text-slate">{catalog.free.days} days · then AI Coach & live CBTs pause</p>
          <ul className="mt-4 space-y-2 text-sm text-forest">
            {catalog.free.includes.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-forest p-6 text-sand">
          <h2 className="font-display text-2xl text-amber-soft">Premium</h2>
          <p className="mt-2 text-3xl font-semibold">
            ₹{catalog.premium.price_inr}
            <span className="ml-2 text-base font-normal text-mint/80">/ {catalog.premium.days} days</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-mint">
            {catalog.premium.includes.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
          <Link
            to={user ? '/dashboard/billing' : '/register'}
            className="mt-6 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-ink"
          >
            {user ? 'Go to billing' : 'Create account'}
          </Link>
        </div>
      </div>
    </div>
  );
}
