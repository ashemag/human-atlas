import {createRoot} from 'react-dom/client';
import {lazy, Suspense} from 'react';
import '../app/globals.css';

const AtlasViewer = lazy(() => import('../app/page'));
const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
const model = pathname === '/female' ? 'female' : pathname === '/male' ? 'male' : null;

document.title = model
  ? `${model === 'female' ? 'Female' : 'Male'} anatomy · Human Atlas`
  : 'Page not found · Human Atlas';

createRoot(document.getElementById('root')!).render(
  model ? (
    <Suspense fallback={<main className="route-loading" role="status">Opening {model} anatomy…</main>}>
      <AtlasViewer model={model} onModelChange={next => window.location.assign(`/${next}`)}/>
    </Suspense>
  ) : (
    <main className="route-loading">
      <h1>Page not found</h1>
      <a href="/">Return to Human Atlas</a>
    </main>
  ),
);
