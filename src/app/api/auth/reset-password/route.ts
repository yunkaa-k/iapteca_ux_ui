import { NextResponse } from 'next/server';

// The old endpoint changed any user's password using only a phone number.
// A password reset must wait for expiring, single-use email tokens and delivery.
export async function POST() {
  return NextResponse.json({ error: 'Відновлення пароля через пошту ще не підключено.' }, { status: 503 });
}
