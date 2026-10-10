import React from 'react';
import {createRoot} from 'react-dom/client';
import {DebuggerApp} from './DebuggerApp';

const el = document.getElementById('root');
if (!el) {
	throw new Error('#root missing');
}
createRoot(el).render(
	<React.StrictMode>
		<DebuggerApp />
	</React.StrictMode>,
);
