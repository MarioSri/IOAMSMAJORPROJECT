import { supabase } from '@/lib/supabase';

export const ALLOWED_DOMAIN = 'hitam.org';

export interface AuthResult {
    success: boolean;
    email?: string;
    role?: string;
    name?: string;
    department?: string;
    branch?: string;
    designation?: string;
    employee_id?: string;
    phone?: string;
    bio?: string;
    avatar?: string;
    error?: string;
    /** The real Supabase Auth UUID — set after a successful sign-in. */
    supabaseUserId?: string;
    /** The role_recipients.id UUID — used as the canonical recipient identifier. */
    recipientId?: string;
}

const ROLE_TEXT_TO_KEY: Record<string, string> = {
    'Principal': 'principal',
    'Registrar': 'registrar',
    'HOD': 'hod',
    'Program Department Head': 'program-head',
    'Employee': 'employee',
};

export function mapRoleTextToKey(roleText: string): string {
    return ROLE_TEXT_TO_KEY[roleText] ?? 'employee';
}

export async function signInWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/`,
            queryParams: {
                hd: ALLOWED_DOMAIN,
            },
        },
    });
    if (error) {
        throw new Error(`Google sign-in failed: ${error.message}`);
    }
}

export async function signOut(): Promise<void> {
    await supabase.auth.signOut();
}

export async function verifyGoogleUser(email: string): Promise<AuthResult> {
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return {
            success: false,
            error: `Only @${ALLOWED_DOMAIN} accounts are allowed. Please use your institutional email.`,
        };
    }

    const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, designation, employee_id, phone, bio, avatar, is_active')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

    if (error) {
        console.error('[AuthService] Error querying role_recipients:', error.message);
        return { success: false, error: 'Database error during verification. Please try again.' };
    }

    if (!data) {
        return {
            success: false,
            error: 'Your account was not found in the system. Please contact the administrator.',
        };
    }

    return {
        success: true,
        recipientId: data.id,
        email: data.email,
        role: mapRoleTextToKey(data.role),
        name: data.name,
        department: data.department ?? '',
        branch: data.branch ?? '',
        designation: data.designation ?? '',
        employee_id: data.employee_id ?? '',
        phone: data.phone ?? '',
        bio: data.bio ?? '',
        avatar: data.avatar ?? '',
    };
}

export async function signInWithEmployeeId(
    employeeId: string,
    password: string
): Promise<AuthResult> {
    if (!employeeId || !password) {
        return { success: false, error: 'Employee ID and password are required.' };
    }

    const { data: profile, error: profileError } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, designation, employee_id, phone, bio, avatar, is_active')
        .eq('employee_id', employeeId.trim())
        .eq('is_active', true)
        .maybeSingle();

    if (profileError) {
        console.error('[AuthService] DB error looking up employee_id:', profileError.message);
        return { success: false, error: 'Database error. Please try again.' };
    }

    if (!profile) {
        return {
            success: false,
            error: 'Employee ID not found. Please check your HITAM ID and try again.',
        };
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
    });

    if (authError || !authData.user) {
        console.error('[AuthService] Supabase Auth error:', authError?.message);

        // Allow dual authentication - users can use either Google or password

        return {
            success: false,
            error: 'Invalid credentials. Please check your password and try again.',
        };
    }

    console.log('[AuthService] Employee ID login successful:', profile.name);
    return {
        success: true,
        supabaseUserId: authData.user.id,
        recipientId: profile.id,
        email: profile.email,
        role: mapRoleTextToKey(profile.role),
        name: profile.name,
        department: profile.department ?? '',
        branch: profile.branch ?? '',
        designation: profile.designation ?? '',
        employee_id: profile.employee_id ?? '',
        phone: profile.phone ?? '',
        bio: profile.bio ?? '',
        avatar: profile.avatar ?? '',
    };
}
