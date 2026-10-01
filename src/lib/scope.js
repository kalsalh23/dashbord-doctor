// Deployment scope, set at build time via VITE_APP_SCOPE:
//  - 'clinic' (default): the clinics' app — reception & doctor interfaces. The super
//    admin control panel is disabled here entirely.
//  - 'owner': the platform owner's app — only the super admin control panel lives here.
export const APP_SCOPE = import.meta.env.VITE_APP_SCOPE === 'owner' ? 'owner' : 'clinic'
