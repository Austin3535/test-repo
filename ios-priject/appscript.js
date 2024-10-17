document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('task-form');
    const taskNameInput = document.getElementById('task-name');
    const taskDurationInput = document.getElementById('task-duration');
    const taskList = document.getElementById('task-list');
    const scheduleTasksButton = document.getElementById('schedule-tasks');
    const calendarEl = document.getElementById('calendar');

    const tasks = [];

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        selectable: true,
        editable: true,
        events: [],
        select: function(info) {
            const taskName = prompt('Enter task name:');
            if (taskName) {
                const isRepeating = confirm('Is this a repeating/permanent task?');
                calendar.addEvent({
                    title: taskName,
                    start: info.startStr,
                    end: info.endStr,
                    allDay: false,
                    daysOfWeek: isRepeating ? [info.start.getDay()] : null // Repeat on the selected day
                });
                if (isRepeating) {
                    tasks.push({ name: taskName, duration: (info.end - info.start) / (1000 * 60 * 60), repeating: true });
                }
            }
            calendar.unselect();
        }
    });

    calendar.render();

    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskName = taskNameInput.value;
        const taskDuration = parseInt(taskDurationInput.value);

        if (taskName && taskDuration) {
            tasks.push({ name: taskName, duration: taskDuration, repeating: false });
            const taskItem = document.createElement('li');
            taskItem.textContent = `${taskName} (${taskDuration} hours)`;
            taskList.appendChild(taskItem);
            taskNameInput.value = '';
            taskDurationInput.value = '';
        } else {
            alert('Please enter a task name and duration.');
        }
    });

    scheduleTasksButton.addEventListener('click', () => {
        const miscTasks = tasks.filter(task => !task.repeating);

        // Schedule miscellaneous tasks
        miscTasks.forEach(task => {
            const bestTime = findBestTime(task.duration);
            if (bestTime) {
                calendar.addEvent({
                    title: task.name,
                    start: bestTime.start,
                    end: bestTime.end
                });
            } else {
                alert(`No available time slots found for task: ${task.name}`);
            }
        });
    });

    function findBestTime(duration) {
        const events = calendar.getEvents();
        const startOfDay = new Date();
        startOfDay.setHours(7, 0, 0, 0); // Start at 7 AM
        const endOfDay = new Date();
        endOfDay.setHours(22, 0, 0, 0); // End at 10 PM

        for (let day = 0; day < 7; day++) {
            let currentTime = new Date(startOfDay);
            currentTime.setDate(currentTime.getDate() + day);

            while (currentTime < endOfDay) {
                const endTime = new Date(currentTime);
                endTime.setHours(currentTime.getHours() + duration);

                if (endTime <= endOfDay && !isOverlapping(events, currentTime, endTime)) {
                    return { start: currentTime.toISOString(), end: endTime.toISOString() };
                }

                currentTime.setHours(currentTime.getHours() + 1);
            }
        }

        return null;
    }

    function isOverlapping(events, start, end) {
        return events.some(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            return (start < eventEnd && end > eventStart);
        });
    }
});