/* Редактируемый конфиг профиля: пояс, раздел, достижения (авто по просмотренным курсам) */
const PROFILE_CONFIG = {
  beltColors: ['белый', 'синий', 'пурпурный', 'коричневый', 'черный'],
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
