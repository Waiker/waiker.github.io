/* Редактируемый конфиг профиля: пояс, раздел, достижения (авто по просмотренным курсам) */
const PROFILE_CONFIG = {
  /* beltColors: массив объектов с id, label, icon. Поддерживается старый формат (массив строк). */
  beltColors: [
    { id: 'belyy', label: 'белый', icon: 'assets/img/belts/white.png', color: '#e8e6e3', colorLight: '#f5f4f2' },
    { id: 'siniy', label: 'синий', icon: 'assets/img/belts/blue.png', color: '#2d5a87', colorLight: '#3d6a9a' },
    { id: 'purpurnyy', label: 'пурпурный', icon: 'assets/img/belts/purple.png', color: '#5a3d6a', colorLight: '#6b4c7a' },
    { id: 'korichnevyy', label: 'коричневый', icon: 'assets/img/belts/brown.png', color: '#4a3728', colorLight: '#5c4535' },
    { id: 'chernyy', label: 'черный', icon: 'assets/img/belts/black.png', color: '#1a1a1a', colorLight: '#2a2a2a' }
  ],
  divisions: [
    { id: 'gi', label: 'Gi' },
    { id: 'nogi', label: 'Nogi' }
  ],
  achievements: [
    { minWatched: 1, label: 'Первый шаг', icon: 'fa-seedling' },
    { minWatched: 5, label: 'Активный ученик', icon: 'fa-graduation-cap' },
    { minWatched: 10, label: 'Мастер', icon: 'fa-trophy' }
  ]
};
