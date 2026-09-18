import Link from "next/link";

export default function ProductShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <main className="product-page">
      <header className="product-header">
        <Link href="/" className="product-brand"><span className="brand-mark">S</span>SuperBot</Link>
        <nav aria-label="Navigation produit">
          <Link href="/">Chat</Link><Link href="/history">Historique</Link><Link href="/skills">Skills</Link><Link href="/files">Fichiers</Link>
          <Link href="/integrations">Intégrations</Link><Link href="/usage">Utilisation</Link>
        </nav>
        <Link className="product-account" href="/auth">Compte</Link>
      </header>
      <section className="product-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
