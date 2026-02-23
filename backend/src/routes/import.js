const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// POST /import/daily — import a full day's data from JSON
router.post('/daily', async (req, res) => {
    try {
        const data = req.body;
        if (!data.date) {
            return res.status(400).json({ error: 'date is required' });
        }

        const date = new Date(data.date);

        // Check for duplicate
        const existing = await prisma.dailyLog.findUnique({
            where: { userId_date: { userId: req.userId, date } }
        });

        if (existing) {
            return res.status(409).json({
                error: 'Log for this date already exists. Use /import/daily/overwrite to replace.',
                date: data.date,
                id: existing.id
            });
        }

        const result = await ingestDailyLog(prisma, req.userId, data);
        res.json({ success: true, date: data.date, ...result });
    } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /import/daily/overwrite — re-import (replaces existing)
router.post('/daily/overwrite', async (req, res) => {
    try {
        const data = req.body;
        if (!data.date) {
            return res.status(400).json({ error: 'date is required' });
        }

        const date = new Date(data.date);

        // Delete existing log and all related data (cascade)
        const existing = await prisma.dailyLog.findUnique({
            where: { userId_date: { userId: req.userId, date } }
        });
        if (existing) {
            await prisma.dailyLog.delete({ where: { id: existing.id } });
        }

        const result = await ingestDailyLog(prisma, req.userId, data);
        res.json({ success: true, overwritten: !!existing, date: data.date, ...result });
    } catch (err) {
        console.error('Import overwrite error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /import/schema — return expected JSON schema for reference
router.get('/schema', (req, res) => {
    res.json({
        description: 'Paste this format when chatting with Claude to generate your daily log',
        example: {
            date: '2026-02-24',
            meta: {
                weight_kg: 82.5,
                wake_time: '06:30',
                sleep_time: '22:30',
                notes: 'Felt good today'
            },
            nutrition: {
                meals: [{
                    meal_type: 'lunch',
                    name: 'Chicken Rice Bowl',
                    calories: 650,
                    protein_g: 45,
                    carbs_g: 70,
                    fat_g: 18,
                    fibre_g: 5,
                    notes: '',
                    components: [
                        { name: 'Chicken breast', weight_g: 200, calories: 330, protein_g: 40, carbs_g: 0, fat_g: 7 },
                        { name: 'White rice', weight_g: 200, calories: 260, protein_g: 5, carbs_g: 58, fat_g: 0.5 }
                    ]
                }],
                totals: { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65 }
            },
            workouts: [{
                type: 'walk',
                start_time: '07:00',
                end_time: '07:45',
                duration_mins: 45,
                active_calories: 250,
                total_calories: 300,
                avg_heart_rate: 120,
                max_heart_rate: 145,
                distance_km: 4.5,
                effort_level: 3,
                notes: 'Morning walk'
            }],
            supplements: [
                { name: 'Creatine', dose_mg: 5000, taken_at: '07:00' },
                { name: 'Magnesium', dose_mg: 400, taken_at: '22:00' }
            ]
        }
    });
});

// Ingest a full daily log from JSON
async function ingestDailyLog(prisma, userId, data) {
    const date = new Date(data.date);
    const meta = data.meta || {};
    const nutrition = data.nutrition || {};
    const meals = nutrition.meals || [];
    const workouts = data.workouts || [];
    const supplements = data.supplements || [];

    // Create daily log
    const log = await prisma.dailyLog.create({
        data: {
            userId,
            date,
            weightKg: meta.weight_kg ? parseFloat(meta.weight_kg) : null,
            wakeTime: meta.wake_time || null,
            sleepTime: meta.sleep_time || null,
            notes: meta.notes || null
        }
    });

    // Create meals with components
    let mealsCreated = 0;
    for (const meal of meals) {
        await prisma.meal.create({
            data: {
                dailyLogId: log.id,
                mealType: meal.meal_type || 'snack',
                name: meal.name || 'Unnamed meal',
                calories: meal.calories ? parseFloat(meal.calories) : null,
                proteinG: meal.protein_g ? parseFloat(meal.protein_g) : null,
                carbsG: meal.carbs_g ? parseFloat(meal.carbs_g) : null,
                fatG: meal.fat_g ? parseFloat(meal.fat_g) : null,
                fibreG: meal.fibre_g ? parseFloat(meal.fibre_g) : null,
                notes: meal.notes || null,
                components: meal.components ? {
                    create: meal.components.map(c => ({
                        name: c.name,
                        weightG: c.weight_g ? parseFloat(c.weight_g) : null,
                        calories: c.calories ? parseFloat(c.calories) : null,
                        proteinG: c.protein_g ? parseFloat(c.protein_g) : null,
                        carbsG: c.carbs_g ? parseFloat(c.carbs_g) : null,
                        fatG: c.fat_g ? parseFloat(c.fat_g) : null
                    }))
                } : undefined
            }
        });
        mealsCreated++;
    }

    // Create workouts
    let workoutsCreated = 0;
    for (const w of workouts) {
        await prisma.workout.create({
            data: {
                dailyLogId: log.id,
                type: w.type || 'other',
                startTime: w.start_time || null,
                endTime: w.end_time || null,
                durationMins: w.duration_mins ? parseInt(w.duration_mins) : null,
                activeCalories: w.active_calories ? parseFloat(w.active_calories) : null,
                totalCalories: w.total_calories ? parseFloat(w.total_calories) : null,
                avgHeartRate: w.avg_heart_rate ? parseInt(w.avg_heart_rate) : null,
                maxHeartRate: w.max_heart_rate ? parseInt(w.max_heart_rate) : null,
                distanceKm: w.distance_km ? parseFloat(w.distance_km) : null,
                effortLevel: w.effort_level ? parseInt(w.effort_level) : null,
                notes: w.notes || null
            }
        });
        workoutsCreated++;
    }

    // Create supplements
    let supplementsCreated = 0;
    for (const s of supplements) {
        await prisma.supplement.create({
            data: {
                dailyLogId: log.id,
                name: s.name,
                doseMg: s.dose_mg ? parseFloat(s.dose_mg) : null,
                takenAt: s.taken_at || null,
                notes: s.notes || null
            }
        });
        supplementsCreated++;
    }

    // Also log weight as body metric if provided
    if (meta.weight_kg) {
        await prisma.bodyMetric.create({
            data: {
                userId,
                date,
                weightKg: parseFloat(meta.weight_kg),
                notes: 'Auto-logged from daily import'
            }
        });
    }

    return {
        logId: log.id,
        mealsCreated,
        workoutsCreated,
        supplementsCreated,
        weightLogged: !!meta.weight_kg
    };
}

module.exports = router;
