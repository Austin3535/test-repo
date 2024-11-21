import SwiftUI

// Models
struct Exercise: Identifiable {
    let id = UUID()
    var name: String
    var sets: Int
    var restPeriod: Int // Rest period in seconds
    var customRestPeriod: Int? // Custom rest period in seconds
}

struct Set: Identifiable {
    let id = UUID()
    var reps: Int
    var weight: Double
    var date: Date
}

struct Day: Identifiable {
    let id = UUID()
    var name: String
    var exercises: [Exercise]
}

struct Workout: Identifiable {
    let id = UUID()
    var name: String
    var days: [Day]
}

class Routine: ObservableObject {
    @Published var workouts: [Workout] = []
    @Published var previousSets: [UUID: [Set]] = [:] // Store previous sets by exercise ID
    @Published var completedWorkouts: [Workout] = [] // Store completed workouts
}

// Views
struct ContentView: View {
    @StateObject var routine = Routine()
    @State private var showingAddWorkout = false
    @State private var showingPresetWorkouts = false
    @State private var showingPastWorkouts = false

    var body: some View {
        NavigationView {
            List {
                ForEach(routine.workouts) { workout in
                    NavigationLink(destination: WorkoutDetailView(workout: workout)) {
                        Text(workout.name)
                    }
                }
            }
            .navigationTitle("My Workouts")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        Button(action: { showingPresetWorkouts.toggle() }) {
                            Image(systemName: "list.bullet")
                        }
                        Button(action: { showingAddWorkout.toggle() }) {
                            Image(systemName: "plus")
                        }
                        Button(action: { showingPastWorkouts.toggle() }) {
                            Image(systemName: "clock.arrow.circlepath")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingAddWorkout) {
                AddWorkoutView()
                    .environmentObject(routine)
            }
            .sheet(isPresented: $showingPresetWorkouts) {
                PresetWorkoutView()
                    .environmentObject(routine)
            }
            .sheet(isPresented: $showingPastWorkouts) {
                PastWorkoutsView()
                    .environmentObject(routine)
            }
        }
        .environmentObject(routine)
    }
}

struct WorkoutDetailView: View {
    var workout: Workout

    var body: some View {
        List {
            ForEach(workout.days) { day in
                NavigationLink(destination: TrackWorkoutView(day: day)) {
                    Text(day.name)
                }
            }
        }
        .navigationTitle(workout.name)
    }
}

struct TrackWorkoutView: View {
    @EnvironmentObject var routine: Routine
    @Environment(\.presentationMode) var presentationMode
    @State private var setsData: [UUID: [Set]] = [:]
    @State private var restTimer: Timer?
    @State private var remainingRestTime: Int = 0
    var day: Day

    var body: some View {
        List {
            ForEach(day.exercises) { exercise in
                Section(header: HStack {
                    Text(exercise.name)
                    Spacer()
                    Button(action: {
                        startRestTimer(for: exercise.customRestPeriod ?? exercise.restPeriod)
                    }) {
                        HStack {
                            Text("Start Rest Timer")
                            if remainingRestTime > 0 {
                                Text("(\(remainingRestTime) sec)")
                            }
                        }
                    }
                }) {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: exercise.sets)) {
                        ForEach(0..<exercise.sets, id: \.self) { setIndex in
                            VStack {
                                Text("Set \(setIndex + 1)")
                                TextField("Weight", value: Binding(
                                    get: { getSetData(for: exercise.id, at: setIndex)?.weight ?? 0 },
                                    set: { setWeight($0, for: exercise.id, at: setIndex) }
                                ), formatter: NumberFormatter())
                                .keyboardType(.decimalPad)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .frame(width: 80)
                                
                                TextField("Reps", value: Binding(
                                    get: { getSetData(for: exercise.id, at: setIndex)?.reps ?? 0 },
                                    set: { setReps($0, for: exercise.id, at: setIndex) }
                                ), formatter: NumberFormatter())
                                .keyboardType(.numberPad)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .frame(width: 80)
                                
                                if setIndex < exercise.sets - 1 {
                                    if remainingRestTime > 0 {
                                        Text("Resting: \(remainingRestTime) sec")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(day.name)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Save") {
                    saveWorkoutData()
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Complete Workout") {
                    completeWorkout()
                    presentationMode.wrappedValue.dismiss()
                }
            }
        }
        .onDisappear {
            restTimer?.invalidate()
        }
    }

    func getSetData(for exerciseID: UUID, at index: Int) -> Set? {
        if let sets = setsData[exerciseID], sets.count > index {
            return sets[index]
        }
        return nil
    }

    func setWeight(_ weight: Double, for exerciseID: UUID, at index: Int) {
        if setsData[exerciseID] == nil {
            setsData[exerciseID] = Array(repeating: Set(reps: 0, weight: 0, date: Date()), count: index + 1)
        }
        if setsData[exerciseID]!.count <= index {
            setsData[exerciseID]!.append(Set(reps: 0, weight: weight, date: Date()))
        } else {
            setsData[exerciseID]![index].weight = weight
        }
    }

    func setReps(_ reps: Int, for exerciseID: UUID, at index: Int) {
        if setsData[exerciseID] == nil {
            setsData[exerciseID] = Array(repeating: Set(reps: 0, weight: 0, date: Date()), count: index + 1)
        }
        if setsData[exerciseID]!.count <= index {
            setsData[exerciseID]!.append(Set(reps: reps, weight: 0, date: Date()))
        } else {
            setsData[exerciseID]![index].reps = reps
        }
    }

    func saveWorkoutData() {
        for (exerciseID, sets) in setsData {
            if routine.previousSets[exerciseID] == nil {
                routine.previousSets[exerciseID] = []
            }
            routine.previousSets[exerciseID]?.append(contentsOf: sets)
        }
    }

    func completeWorkout() {
        saveWorkoutData()
        let completedWorkout = Workout(name: day.name, days: [day])
        routine.completedWorkouts.append(completedWorkout)
    }

    func startRestTimer(for duration: Int) {
        remainingRestTime = duration
        restTimer?.invalidate()
        restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { timer in
            if remainingRestTime > 0 {
                remainingRestTime -= 1
            } else {
                timer.invalidate()
            }
        }
    }
}

struct AddWorkoutView: View {
    @EnvironmentObject var routine: Routine
    @Environment(\.presentationMode) var presentationMode
    @State private var workoutName = ""
    @State private var days: [Day] = []

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Workout Name")) {
                    TextField("Enter workout name", text: $workoutName)
                }
                Section(header: Text("Days")) {
                    ForEach($days) { $day in
                        VStack(alignment: .leading) {
                            TextField("Day Name", text: $day.name)
                                .font(.headline)
                            ForEach($day.exercises) { $exercise in
                                VStack(alignment: .leading) {
                                    TextField("Exercise Name", text: $exercise.name)
                                    Stepper(value: $exercise.sets, in: 1...10) {
                                        Text("Sets: \(exercise.sets)")
                                    }
                                    Picker("Rest Period", selection: $exercise.restPeriod) {
                                        Text("1 min").tag(60)
                                        Text("2 min").tag(120)
                                        Text("5 min").tag(300)
                                        Text("Custom").tag(-1)
                                    }
                                    .pickerStyle(SegmentedPickerStyle())
                                    if exercise.restPeriod == -1 {
                                        TextField("Custom Rest Period (seconds)", value: $exercise.customRestPeriod, formatter: NumberFormatter())
                                            .keyboardType(.numberPad)
                                            .textFieldStyle(RoundedBorderTextFieldStyle())
                                    }
                                }
                            }
                            Button(action: { addExercise(to: day) }) {
                                Text("Add Exercise")
                            }
                        }
                    }
                    .onDelete(perform: deleteDay)
                    Button(action: addDay) {
                        Text("Add Day")
                    }
                }
            }
            .navigationTitle("Create Workout")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveWorkout()
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
    }

    func addDay() {
        let newDay = Day(name: "", exercises: [])
        days.append(newDay)
    }

    func deleteDay(at offsets: IndexSet) {
        days.remove(atOffsets: offsets)
    }

    func addExercise(to day: Day) {
        if let index = days.firstIndex(where: { $0.id == day.id }) {
            days[index].exercises.append(Exercise(name: "", sets: 3, restPeriod: 120, customRestPeriod: nil)) // Default to 3 sets and 2 min rest
        }
    }

    func saveWorkout() {
        let newWorkout = Workout(name: workoutName, days: days)
        routine.workouts.append(newWorkout)
    }
}

struct PresetWorkoutView: View {
    @EnvironmentObject var routine: Routine
    @Environment(\.presentationMode) var presentationMode

    let presetWorkouts: [Workout] = [
        Workout(name: "Full Body Workout", days: [
            Day(name: "Day 1", exercises: [
                Exercise(name: "Squats", sets: 3, restPeriod: 300, customRestPeriod: nil),
                Exercise(name: "Bench Press", sets: 3, restPeriod: 300, customRestPeriod: nil),
                Exercise(name: "Deadlift", sets: 3, restPeriod: 300, customRestPeriod: nil)
            ]),
            Day(name: "Day 2", exercises: [
                Exercise(name: "Pull-ups", sets: 3, restPeriod: 120, customRestPeriod: nil),
                Exercise(name: "Overhead Press", sets: 3, restPeriod: 120, customRestPeriod: nil),
                Exercise(name: "Rows", sets: 3, restPeriod: 120, customRestPeriod: nil)
            ])
        ]),
        Workout(name: "Upper/Lower Split", days: [
            Day(name: "Upper Body", exercises: [
                Exercise(name: "Bench Press", sets: 3, restPeriod: 120, customRestPeriod: nil),
                Exercise(name: "Rows", sets: 3, restPeriod: 120, customRestPeriod: nil),
                Exercise(name: "Overhead Press", sets: 3, restPeriod: 120, customRestPeriod: nil),
                Exercise(name: "Pull-ups", sets: 3, restPeriod: 120, customRestPeriod: nil)
            ]),
            Day(name: "Lower Body", exercises: [
                Exercise(name: "Squats", sets: 3, restPeriod: 300, customRestPeriod: nil),
                Exercise(name: "Deadlift", sets: 3, restPeriod: 300, customRestPeriod: nil),
                Exercise(name: "Leg Press", sets: 3, restPeriod: 120, customRestPeriod: nil),
                Exercise(name: "Calf Raises", sets: 3, restPeriod: 60, customRestPeriod: nil)
            ])
        ])
    ]

    var body: some View {
        NavigationView {
            List {
                ForEach(presetWorkouts) { workout in
                    Button(action: {
                        addPresetWorkout(workout)
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Text(workout.name)
                    }
                }
            }
            .navigationTitle("Preset Workouts")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
    }

    func addPresetWorkout(_ workout: Workout) {
        routine.workouts.append(workout)
    }
}

struct PastWorkoutsView: View {
    @EnvironmentObject var routine: Routine

    var body: some View {
        NavigationView {
            List {
                Section(header: Text("This Week")) {
                    ForEach(filteredWorkouts(for: .week)) { workout in
                        NavigationLink(destination: PastWorkoutDetailView(workout: workout)) {
                            workoutRow(workout)
                        }
                    }
                }
                Section(header: Text("This Month")) {
                    ForEach(filteredWorkouts(for: .month)) { workout in
                        NavigationLink(destination: PastWorkoutDetailView(workout: workout)) {
                            workoutRow(workout)
                        }
                    }
                }
                Section(header: Text("This Year")) {
                    ForEach(filteredWorkouts(for: .year)) { workout in
                        NavigationLink(destination: PastWorkoutDetailView(workout: workout)) {
                            workoutRow(workout)
                        }
                    }
                }
                Section(header: Text("Older")) {
                    ForEach(filteredWorkouts(for: .older)) { workout in
                        NavigationLink(destination: PastWorkoutDetailView(workout: workout)) {
                            workoutRow(workout)
                        }
                    }
                }
            }
            .navigationTitle("Past Workouts")
        }
    }

    private func filteredWorkouts(for period: TimePeriod) -> [Workout] {
        let now = Date()
        return routine.completedWorkouts.filter { workout in
            guard let date = getFirstSetDate(for: workout) else { return false }
            switch period {
            case .week:
                return Calendar.current.isDate(date, equalTo: now, toGranularity: .weekOfYear)
            case .month:
                return Calendar.current.isDate(date, equalTo: now, toGranularity: .month)
            case .year:
                return Calendar.current.isDate(date, equalTo: now, toGranularity: .year)
            case .older:
                return !Calendar.current.isDate(date, equalTo: now, toGranularity: .year)
            }
        }
    }

    private func getFirstSetDate(for workout: Workout) -> Date? {
        for day in workout.days {
            for exercise in day.exercises {
                if let firstSet = routine.previousSets[exercise.id]?.first {
                    return firstSet.date
                }
            }
        }
        return nil
    }

    private func workoutRow(_ workout: Workout) -> some View {
        VStack(alignment: .leading) {
            Text(workout.name)
                .font(.headline)
            ForEach(workout.days) { day in
                ForEach(day.exercises) { exercise in
                    if let previousSets = routine.previousSets[exercise.id] {
                        ForEach(previousSets) { set in
                            HStack {
                                Text(day.name)
                                Spacer()
                                Text("Weight: \(set.weight, specifier: "%.2f") lbs")
                                Spacer()
                                Text("Reps: \(set.reps)")
                                Spacer()
                                Text("\(set.date, formatter: dateFormatter)")
                            }
                        }
                    }
                }
            }
        }
    }

    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }

    private enum TimePeriod {
        case week, month, year, older
    }
}

struct PastWorkoutDetailView: View {
    var workout: Workout

    var body: some View {
        List {
            ForEach(workout.days) { day in
                Section(header: Text(day.name)) {
                    exerciseList(for: day)
                }
            }
        }
        .navigationTitle(workout.name)
    }

    private func exerciseList(for day: Day) -> some View {
        ForEach(day.exercises) { exercise in
            VStack(alignment: .leading) {
                Text(exercise.name)
                    .font(.headline)
                setList(for: exercise)
            }
        }
    }

    private func setList(for exercise: Exercise) -> some View {
        if let sets = routine.previousSets[exercise.id] {
            ForEach(sets) { set in
                HStack {
                    Text("Weight: \(set.weight, specifier: "%.2f") lbs")
                    Spacer()
                    Text("Reps: \(set.reps)")
                    Spacer()
                    Text("Date: \(set.date, formatter: dateFormatter)")
                }
            }
        } else {
            Text("No sets recorded")
        }
    }

    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }
}

// Preview
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(Routine())
    }
}