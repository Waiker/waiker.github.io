/* Редактируемый конфиг профиля: пояс, раздел, достижения (авто по просмотренным курсам) */
const PROFILE_CONFIG = {
  /* beltColors: массив объектов с id, label, icon. Поддерживается старый формат (массив строк). */
  beltColors: [
    { id: 'belyy', label: 'белый', icon: 'assets/img/belts/white.png' },
    { id: 'siniy', label: 'синий', icon: 'assets/img/belts/blue.png' },
    { id: 'purpurnyy', label: 'пурпурный', icon: 'assets/img/belts/purple.png' },
    { id: 'korichnevyy', label: 'коричневый', icon: 'assets/img/belts/brown.png' },
    { id: 'chernyy', label: 'черный', icon: 'assets/img/belts/black.png' }
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
