import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/client';

function MacroBar({ label, current, target, color, unit = 'g' }) {
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-surface-200">{label}</span>
                <span className="font-medium">{Math.round(current)}<span className="text-surface-200">/{target}{unit}</span></span>
            </div>
            <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub, color }) {
    return (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5 hover:border-surface-700 transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg`} style={{ backgroundColor: `${color}20` }}>
                    {icon}
                </div>
                <span className="text-surface-200 text-sm">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-surface-200 text-sm mt-1">{sub}</p>}
        </div>
    );
}

function QuickAddButton({ icon, label, to }) {
    return (
        <Link
            to={to}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface-900 border border-surface-800 hover:border-primary-500/50 hover:bg-surface-800 transition-all duration-200 group"
        >
            <span className="text-2xl group-hover:scale-110 transition-transform">{icon}</span>
            <span className="text-xs text-surface-200 group-hover:text-white transition-colors">{label}</span>
        </Link>
    );
}

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/dashboard/today')
            .then(res => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
            </div>
        );
    }

    const macros = data?.macros || { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
    const exercise = data?.exercise || { activeCalories: 0, totalMins: 0, workoutCount: 0 };
    const goals = data?.goals || [];
    const weightTrend = (data?.weightTrend || []).map(d => ({
        date: format(new Date(d.date), 'MMM d'),
        weight: d.weightKg
    }));

    const calorieGoal = goals.find(g => g.goalType === 'calories')?.targetValue || 2000;
    const proteinGoal = goals.find(g => g.goalType === 'protein')?.targetValue || 150;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-surface-200 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon="🔥" label="Calories In" value={Math.round(macros.calories)} sub={`of ${calorieGoal} target`} color="#f59e0b" />
                <StatCard icon="💪" label="Active Burn" value={Math.round(exercise.activeCalories)} sub={`${exercise.workoutCount} workouts`} color="#ef4444" />
                <StatCard icon="⚡" label="Net Calories" value={Math.round(data?.netCalories || 0)} sub="intake − burn" color="#6366f1" />
                <StatCard icon="⏱️" label="Exercise" value={`${exercise.totalMins}m`} sub={`${exercise.workoutCount} sessions`} color="#10b981" />
            </div>

            {/* Macro Progress */}
            <div className="bg-surface-900 border border-surface-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-5">Macro Progress</h2>
                <div className="space-y-4">
                    <MacroBar label="Calories" current={macros.calories} target={calorieGoal} color="#f59e0b" unit="kcal" />
                    <MacroBar label="Protein" current={macros.protein} target={proteinGoal} color="#ef4444" />
                    <MacroBar label="Carbs" current={macros.carbs} target={250} color="#3b82f6" />
                    <MacroBar label="Fat" current={macros.fat} target={65} color="#a855f7" />
                    <MacroBar label="Fibre" current={macros.fibre} target={30} color="#10b981" />
                </div>
            </div>

            {/* Weight Trend + Quick Add */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Weight Sparkline */}
                <div className="bg-surface-900 border border-surface-800 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Weight Trend</h2>
                    {weightTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={weightTrend}>
                                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }}
                                    formatter={(val) => [`${val} kg`, 'Weight']}
                                />
                                <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6, stroke: '#818cf8', strokeWidth: 2 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[180px] flex items-center justify-center text-surface-200">
                            No weight data yet. Log your first weigh-in!
                        </div>
                    )}
                </div>

                {/* Quick Add */}
                <div className="bg-surface-900 border border-surface-800 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Quick Add</h2>
                    <div className="grid grid-cols-3 gap-3">
                        <QuickAddButton icon="🍽️" label="Meal" to="/meals/add" />
                        <QuickAddButton icon="🏃" label="Workout" to="/workouts" />
                        <QuickAddButton icon="⚖️" label="Weigh-in" to={`/log/${format(new Date(), 'yyyy-MM-dd')}`} />
                        <QuickAddButton icon="💊" label="Supplement" to={`/log/${format(new Date(), 'yyyy-MM-dd')}`} />
                        <QuickAddButton icon="📸" label="Photo" to="/progress" />
                        <QuickAddButton icon="📈" label="Progress" to="/progress" />
                    </div>
                </div>
            </div>

            {/* Today's Supplements */}
            {(data?.supplements?.length > 0) && (
                <div className="bg-surface-900 border border-surface-800 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Today's Supplements</h2>
                    <div className="flex flex-wrap gap-3">
                        {data.supplements.map(s => (
                            <span key={s.id} className="px-4 py-2 rounded-xl bg-accent-500/10 border border-accent-500/20 text-accent-400 text-sm font-medium">
                                {s.name} {s.doseMg ? `${s.doseMg}mg` : ''}
                                {s.takenAt && <span className="text-surface-200 ml-1">@ {s.takenAt}</span>}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
