// Supabase Client and Frontend logic integration
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase if SDK is loaded
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

document.getElementById('athleteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
        alert('لطفاً تنظیمات Supabase را بررسی کنید.');
        return;
    }
    const name = document.getElementById('name').value;
    const national_id = document.getElementById('national_id').value;
    const belt = document.getElementById('belt').value;
    const weight_category = document.getElementById('weight_category').value;

    const { data, error } = await supabaseClient
        .from('athletes')
        .insert([{ name, national_id, belt, weight_category }]);

    if (error) {
        alert('خطا در ثبت اطلاعات: ' + error.message);
    } else {
        alert('ورزشکار با موفقیت ثبت شد!');
        document.getElementById('athleteForm').reset();
    }
});