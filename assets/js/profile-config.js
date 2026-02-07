/* Редактируемый конфиг профиля: пояс, раздел, достижения (авто по просмотренным курсам) */
const PROFILE_CONFIG = {
  /* beltColors: массив объектов с id, label, icon. Поддерживается старый формат (массив строк). */
  beltColors: [
    { id: 'belyy', label: 'белый', icon: 'assets/img/belts/white.png', color: '#d4d0c8', colorLight: '#f0ede8' },
    { id: 'siniy', label: 'синий', icon: 'assets/img/belts/blue.png', color: '#1e4a6e', colorLight: '#3a7ab0' },
    { id: 'purpurnyy', label: 'пурпурный', icon: 'assets/img/belts/purple.png', color: '#4a2d5a', colorLight: '#7a4a8e' },
    { id: 'korichnevyy', label: 'коричневый', icon: 'assets/img/belts/brown.png', color: '#3d2a1e', colorLight: '#6b4a35' },
    { id: 'chernyy', label: 'черный', icon: 'assets/img/belts/black.png', color: '#0d0d0d', colorLight: '#2d2d2d' }
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
