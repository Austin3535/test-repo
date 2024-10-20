import SwiftUI
import FSCalendar
import EventKit

struct ContentView: View {
    @State private var showingAddSheet = false
    @State private var routines: [Routine] = []
    @State private var tasks: [Task] = []

    var body: some View {
        TabView {
            ToDoView(showingAddSheet: $showingAddSheet, routines: $routines, tasks: $tasks)
                .tabItem {
                    Image(systemName: "list.bullet")
                    Text("To-Do")
                }
            
            CustomCalendarView()
                .tabItem {
                    Image(systemName: "calendar")
                    Text("Calendar")
                }
        }
    }
}

struct ToDoView: View {
    @Binding var showingAddSheet: Bool
    @Binding var routines: [Routine]
    @Binding var tasks: [Task]

    var body: some View {
        NavigationView {
            List {
                Section(header: Text("Routines")) {
                    ForEach(routines) { routine in
                        Text(routine.name)
                            .font(.headline)
                    }
                    .onDelete(perform: deleteRoutine)
                    .onMove(perform: moveRoutine)
                }
                
                Section(header: Text("Tasks")) {
                    ForEach($tasks) { $task in
                        HStack {
                            Button(action: {
                                task.completed.toggle()
                            }) {
                                Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(task.completed ? .green : .gray)
                            }
                            VStack(alignment: .leading) {
                                Text(task.name)
                                    .font(.headline)
                                    .strikethrough(task.completed, color: .gray)
                                if let date = task.date {
                                    Text("Scheduled for: \(date, style: .date) \(date, style: .time)")
                                        .font(.subheadline)
                                        .strikethrough(task.completed, color: .gray)
                                } else if let estimatedTime = task.estimatedTime {
                                    Text("Estimated time: \(estimatedTime) minutes")
                                        .font(.subheadline)
                                        .strikethrough(task.completed, color: .gray)
                                }
                            }
                        }
                    }
                    .onDelete(perform: deleteTask)
                    .onMove(perform: moveTask)
                }
            }
            .navigationBarTitle("To-Do")
            .navigationBarItems(
                leading: EditButton(),
                trailing: Button(action: {
                    showingAddSheet.toggle()
                }) {
                    Image(systemName: "plus")
                }
            )
            .sheet(isPresented: $showingAddSheet) {
                AddItemView(routines: $routines, tasks: $tasks)
            }
        }
    }

    func deleteRoutine(at offsets: IndexSet) {
        routines.remove(atOffsets: offsets)
    }

    func deleteTask(at offsets: IndexSet) {
        tasks.remove(atOffsets: offsets)
    }

    func moveRoutine(from source: IndexSet, to destination: Int) {
        routines.move(fromOffsets: source, toOffset: destination)
    }

    func moveTask(from source: IndexSet, to destination: Int) {
        tasks.move(fromOffsets: source, toOffset: destination)
    }
}

struct AddItemView: View {
    @Environment(\.presentationMode) var presentationMode
    @State private var selectedSegment = 0
    @State private var itemName: String = ""
    @State private var startTime = Date()
    @State private var endTime = Date()
    @State private var selectedDays = Set<Int>()
    @State private var taskDate: Date? = nil
    @State private var estimatedTime: Int? = nil
    @Binding var routines: [Routine]
    @Binding var tasks: [Task]

    var body: some View {
        NavigationView {
            Form {
                Picker("Type", selection: $selectedSegment) {
                    Text("Routine").tag(0)
                    Text("Task").tag(1)
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding()

                TextField(selectedSegment == 0 ? "Routine Name" : "Task Name", text: $itemName)
                
                if selectedSegment == 0 {
                    DatePicker("Start Time", selection: $startTime, displayedComponents: .hourAndMinute)
                    DatePicker("End Time", selection: $endTime, displayedComponents: .hourAndMinute)
                    
                    Section(header: Text("Days of the Week")) {
                        ForEach(0..<7) { index in
                            Button(action: {
                                if selectedDays.contains(index) {
                                    selectedDays.remove(index)
                                } else {
                                    selectedDays.insert(index)
                                }
                            }) {
                                HStack {
                                    Text(Calendar.current.shortWeekdaySymbols[index])
                                    Spacer()
                                    if selectedDays.contains(index) {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    }
                } else {
                    Section(header: Text("Scheduling Options")) {
                        Toggle("Set Date and Time", isOn: Binding(
                            get: { taskDate != nil },
                            set: { if $0 { taskDate = Date() } else { taskDate = nil } }
                        ))
                        
                        if taskDate != nil {
                            DatePicker("Date and Time", selection: Binding(
                                get: { taskDate ?? Date() },
                                set: { taskDate = $0 }
                            ))
                        }
                        
                        Toggle("Set Estimated Time", isOn: Binding(
                            get: { estimatedTime != nil },
                            set: { if $0 { estimatedTime = 30 } else { estimatedTime = nil } }
                        ))
                        
                        if estimatedTime != nil {
                            Picker("Estimated Time (minutes)", selection: Binding(
                                get: { estimatedTime ?? 30 },
                                set: { estimatedTime = $0 }
                            )) {
                                ForEach(1..<241) { minute in
                                    Text("\(minute) minutes").tag(minute)
                                }
                            }
                            .pickerStyle(WheelPickerStyle())
                        }
                    }
                }
                
                Button(action: addItem) {
                    Text("Add \(selectedSegment == 0 ? "Routine" : "Task")")
                }
            }
            .navigationBarTitle("Add Item")
            .navigationBarItems(trailing: Button("Cancel") {
                presentationMode.wrappedValue.dismiss()
            })
        }
    }

    func addItem() {
        if selectedSegment == 0 {
            guard !itemName.isEmpty else { return }
            let newRoutine = Routine(name: itemName, startTime: startTime, endTime: endTime, daysOfWeek: Array(selectedDays))
            routines.append(newRoutine)
        } else {
            guard !itemName.isEmpty else { return }
            let newTask = Task(name: itemName, date: taskDate, estimatedTime: estimatedTime, completed: false)
            tasks.append(newTask)
        }
        presentationMode.wrappedValue.dismiss()
    }
}

struct CustomCalendarView: View {
    @State private var selectedDate = Date()
    @State private var showingAddEventSheet = false
    @State private var selectedView = "Month"
    @StateObject private var calendarViewModel = CalendarViewModel()

    var body: some View {
        NavigationView {
            VStack {
                Picker("View", selection: $selectedView) {
                    Text("Day").tag("Day")
                    Text("Week").tag("Week")
                    Text("Month").tag("Month")
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding()

                if selectedView == "Day" {
                    DayView(selectedDate: $selectedDate, events: $calendarViewModel.events)
                } else if selectedView == "Week" {
                    WeekView(selectedDate: $selectedDate, events: $calendarViewModel.events)
                } else {
                    CalendarViewRepresentable(selectedDate: $selectedDate, events: $calendarViewModel.events)
                        .frame(maxHeight: .infinity)
                }
            }
            .padding()
            .navigationBarTitle("Calendar", displayMode: .inline)
            .navigationBarItems(trailing: Button(action: {
                showingAddEventSheet.toggle()
            }) {
                Image(systemName: "plus")
                    .font(.title2)
            })
            .sheet(isPresented: $showingAddEventSheet) {
                AddEventView(selectedDate: $selectedDate, calendarViewModel: calendarViewModel)
            }
            .onAppear {
                calendarViewModel.requestAccess()
            }
        }
    }
}

struct CalendarViewRepresentable: UIViewControllerRepresentable {
    @Binding var selectedDate: Date
    @Binding var events: [EventWrapper]

    func makeUIViewController(context: Context) -> UIViewController {
        let calendarVC = UIViewController()
        let calendar = FSCalendar()
        calendar.delegate = context.coordinator
        calendar.dataSource = context.coordinator
        calendar.appearance.headerTitleColor = .black
        calendar.appearance.weekdayTextColor = .black
        calendar.appearance.todayColor = .red
        calendar.appearance.selectionColor = .blue
        calendar.appearance.eventDefaultColor = .blue
        calendar.appearance.eventSelectionColor = .blue
        calendar.appearance.headerDateFormat = "MMMM yyyy"
        calendar.appearance.headerMinimumDissolvedAlpha = 0.0
        calendar.appearance.caseOptions = [.headerUsesUpperCase, .weekdayUsesSingleUpperCase]
        calendarVC.view.addSubview(calendar)
        calendar.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            calendar.leadingAnchor.constraint(equalTo: calendarVC.view.leadingAnchor),
            calendar.trailingAnchor.constraint(equalTo: calendarVC.view.trailingAnchor),
            calendar.topAnchor.constraint(equalTo: calendarVC.view.topAnchor),
            calendar.bottomAnchor.constraint(equalTo: calendarVC.view.bottomAnchor)
        ])
        return calendarVC
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        // Update the view controller if needed
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, FSCalendarDelegate, FSCalendarDataSource {
        var parent: CalendarViewRepresentable

        init(_ parent: CalendarViewRepresentable) {
            self.parent = parent
        }

        func calendar(_ calendar: FSCalendar, didSelect date: Date, at monthPosition: FSCalendarMonthPosition) {
            parent.selectedDate = date
        }

        func calendar(_ calendar: FSCalendar, numberOfEventsFor date: Date) -> Int {
            return parent.events.filter { Calendar.current.isDate($0.event.startDate, inSameDayAs: date) }.count
        }

        func calendar(_ calendar: FSCalendar, eventDefaultColorsFor date: Date) -> [UIColor]? {
            return parent.events.filter { Calendar.current.isDate($0.event.startDate, inSameDayAs: date) }.map { _ in UIColor.blue }
        }
    }
}

struct DayView: View {
    @Binding var selectedDate: Date
    @Binding var events: [EventWrapper]

    var body: some View {
        VStack {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(0..<7) { offset in
                        let date = Calendar.current.date(byAdding: .day, value: offset, to: startOfWeek(for: selectedDate))!
                        Button(action: {
                            selectedDate = date
                        }) {
                            VStack {
                                Text(date, style: .date)
                                    .font(.headline)
                                    .foregroundColor(Calendar.current.isDate(date, inSameDayAs: selectedDate) ? .blue : .primary)
                                Text(Calendar.current.shortWeekdaySymbols[Calendar.current.component(.weekday, from: date) - 1])
                                    .font(.subheadline)
                                    .foregroundColor(Calendar.current.isDate(date, inSameDayAs: selectedDate) ? .blue : .primary)
                            }
                            .padding()
                            .background(Calendar.current.isDate(date, inSameDayAs: selectedDate) ? Color.blue.opacity(0.2) : Color.clear)
                            .cornerRadius(10)
                        }
                    }
                }
                .padding(.horizontal)
            }
            HourlyTimelineView(selectedDate: $selectedDate, events: $events)
        }
    }

    func startOfWeek(for date: Date) -> Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return calendar.date(from: components)!
    }
}

struct WeekView: View {
    @Binding var selectedDate: Date
    @Binding var events: [EventWrapper]

    var body: some View {
        VStack {
            ForEach(0..<7) { offset in
                let date = Calendar.current.date(byAdding: .day, value: offset, to: startOfWeek(for: selectedDate))!
                Text(date, style: .date)
                    .font(.headline)
                HourlyTimelineView(selectedDate: .constant(date), events: $events)
            }
        }
    }

    func startOfWeek(for date: Date) -> Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return calendar.date(from: components)!
    }
}

struct HourlyTimelineView: View {
    @Binding var selectedDate: Date
    @Binding var events: [EventWrapper]

    var body: some View {
        let eventsByHour = Dictionary(grouping: events.filter { Calendar.current.isDate($0.event.startDate, inSameDayAs: selectedDate) }) { event in
            Calendar.current.component(.hour, from: event.event.startDate)
        }

        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(0..<24) { hour in
                        HStack {
                            Text("\(hour):00")
                                .frame(width: 50, alignment: .leading)
                            Rectangle()
                                .fill(Color.gray.opacity(0.2))
                                .frame(height: 1)
                            VStack(alignment: .leading) {
                                ForEach(eventsByHour[hour] ?? []) { eventWrapper in
                                    Text(eventWrapper.event.title)
                                        .padding(5)
                                        .background(Color.blue.opacity(0.3))
                                        .cornerRadius(5)
                                }
                            }
                        }
                        .frame(height: 60)
                    }
                }
                .overlay(CurrentTimeIndicator(), alignment: .top)
            }
        }
    }
}

struct CurrentTimeIndicator: View {
    @State private var currentTime = Date()

    var body: some View {
        GeometryReader { geometry in
            let totalMinutes = Calendar.current.component(.hour, from: currentTime) * 60 + Calendar.current.component(.minute, from: currentTime)
            let yOffset = CGFloat(totalMinutes) / 1440 * geometry.size.height

            Rectangle()
                .fill(Color.red)
                .frame(height: 2)
                .offset(y: yOffset)
                .onAppear(perform: updateCurrentTime)
                .onReceive(Timer.publish(every: 60, on: .main, in: .common).autoconnect()) { _ in
                    updateCurrentTime()
                }
        }
    }

    private func updateCurrentTime() {
        currentTime = Date()
    }
}

struct AddEventView: View {
    @Environment(\.presentationMode) var presentationMode
    @Binding var selectedDate: Date
    @State private var eventTitle: String = ""
    @State private var startTime = Date()
    @State private var endTime = Date()
    @ObservedObject var calendarViewModel: CalendarViewModel
    private let eventStore = EKEventStore()

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Event Details")) {
                    TextField("Event Title", text: $eventTitle)
                    DatePicker("Start Time", selection: $startTime, displayedComponents: .hourAndMinute)
                    DatePicker("End Time", selection: $endTime, displayedComponents: .hourAndMinute)
                }
                Button(action: addEvent) {
                    Text("Add Event")
                }
            }
            .navigationBarTitle("Add Event")
            .navigationBarItems(trailing: Button("Cancel") {
                presentationMode.wrappedValue.dismiss()
            })
        }
    }

    func addEvent() {
        let event = EKEvent(eventStore: eventStore)
        event.title = eventTitle
        event.startDate = startTime
        event.endDate = endTime
        event.calendar = eventStore.defaultCalendarForNewEvents
        do {
            try eventStore.save(event, span: .thisEvent)
            calendarViewModel.fetchEvents()
            presentationMode.wrappedValue.dismiss()
        } catch {
            print("Error saving event: \(error)")
        }
    }
}

class CalendarViewModel: ObservableObject {
    private let eventStore = EKEventStore()
    @Published var events: [EventWrapper] = []

    func requestAccess() {
        eventStore.requestFullAccessToEvents { granted, error in
            if granted {
                self.fetchEvents()
            } else {
                // Handle the error or lack of permission
                print("Access denied or error: \(String(describing: error?.localizedDescription))")
            }
        }
    }

    func fetchEvents() {
        let calendars = eventStore.calendars(for: .event)
        let oneMonthAgo = Date().addingTimeInterval(-30*24*3600)
        let oneMonthAfter = Date().addingTimeInterval(30*24*3600)
        let predicate = eventStore.predicateForEvents(withStart: oneMonthAgo, end: oneMonthAfter, calendars: calendars)
        let events = eventStore.events(matching: predicate).map { EventWrapper(event: $0) }
        DispatchQueue.main.async {
            self.events = events
            print("Fetched \(events.count) events")
        }
    }
}

struct EventWrapper: Identifiable {
    let id: String
    let event: EKEvent

    init(event: EKEvent) {
        self.id = event.eventIdentifier
        self.event = event
    }
}

struct Routine: Identifiable {
    let id = UUID()
    let name: String
    let startTime: Date
    let endTime: Date
    let daysOfWeek: [Int]
}

struct Task: Identifiable {
    let id = UUID()
    let name: String
    let date: Date?
    let estimatedTime: Int?
    var completed: Bool
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
